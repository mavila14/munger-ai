import json
import base64
import requests
import logging
import azure.functions as func
import re
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("munger_ai_api")

# Define Gemini API key
GEMINI_API_KEY = "AIzaSyB-RIjhhODp6aPTzqVcwbXD894oebXFCUY"

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Functions HTTP trigger function for analyzing purchase decisions.
    
    This function uses the Gemini API to make a direct buy/don't buy recommendation
    and can search for cheaper alternatives using Google Search grounding.
    """
    try:
        body = req.get_json()
    except:
        return func.HttpResponse("Invalid JSON body", status_code=400)
    
    item_name = body.get("itemName", "")
    item_cost = float(body.get("itemCost", 0))
    image_base64 = body.get("imageBase64", None)
    advanced_data = body.get("advancedData", None)
    find_alternatives = body.get("findAlternatives", False)
    
    try:
        # If image is provided but no item name, get item details from image
        item_details = {}
        if image_base64:
            item_details = analyze_image_with_gemini(item_name, image_base64)
            
            # If image analysis returns an item name and the user didn't provide one
            if item_details.get("name") and item_details["name"] != "Error" and not item_name:
                item_name = item_details["name"]
                logger.info(f"Item identified from image: {item_name}")
        
        # If we still have no item name, return an error
        if not item_name:
            return func.HttpResponse(
                json.dumps({
                    "error": "No item name could be determined",
                    "message": "Please provide an item name or a clearer image"
                }),
                status_code=400,
                mimetype="application/json"
            )
        
        # Find cheaper alternatives if requested
        alternative = None
        if find_alternatives and item_name:
            alternative = find_cheaper_alternative_with_search(item_name, item_cost)
        
        # Get buy/don't buy recommendation with advanced data if available
        recommendation = get_purchase_recommendation(item_name, item_cost, alternative, advanced_data)
        
        # Build response
        response_data = {
            "name": item_name,
            "cost": item_cost,
            "recommendation": recommendation["decision"],
            "explanation": recommendation["explanation"]
        }
        
        # Add image analysis details if available
        if image_base64 and "facts" in item_details:
            response_data["facts"] = item_details["facts"]
        
        # Add alternative if found
        if alternative:
            response_data["alternative"] = alternative
        
        return func.HttpResponse(
            json.dumps(response_data),
            status_code=200,
            mimetype="application/json"
        )
    
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": str(e),
                "message": "Error analyzing purchase decision"
            }),
            status_code=500,
            mimetype="application/json"
        )

def analyze_image_with_gemini(item_name: str, image_base64: str) -> dict:
    """
    Analyze an image using the Gemini API to identify and provide facts about an item.
    """
    instructions = """
      You are shown a single consumer item.
      1. Identify it with brand/model if visible
      2. Estimate cost in USD
      3. Provide 1-2 sentences of interesting facts

      Return only valid JSON in this format:
      {
        "name": "...",
        "cost": 123.45,
        "facts": "..."
      }
    """
    
    gemini_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-pro:generateContent?key={GEMINI_API_KEY}"
    )
    
    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": instructions},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }
                    }
                ]
            }
        ]
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        resp = requests.post(gemini_url, headers=headers, json=request_body)
        resp.raise_for_status()
        gemini_response = resp.json()
        text = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
        return extract_json(text)
    except Exception as e:
        logger.error(f"Error calling Gemini API for image analysis: {str(e)}")
        return {
            "name": "Error",
            "cost": 0,
            "facts": f"Error analyzing image: {e}"
        }

def find_cheaper_alternative_with_search(item_name: str, item_cost: float) -> dict:
    """
    Find cheaper alternatives using Google Search Grounding with Gemini 2.0
    
    Returns a dict with name, price, and URL of a cheaper alternative, or None if not found.
    """
    prompt = f"""
    Find a cheaper alternative to "{item_name}" that costs less than ${item_cost}.
    
    I want you to use Google Search to find real alternatives available for purchase NOW from reputable online retailers.
    
    For the selected alternative:
    1. Provide the exact product name 
    2. Provide the exact price (must be lower than ${item_cost})
    3. Provide the DIRECT PRODUCT URL that goes to the product page on the retailer's website, not a search results page
       - The URL must be a complete, clickable link that takes users directly to the product page
       - Verify the URL is accessible and goes to the actual product listing
       - Do NOT provide shortened URLs or affiliate links
    4. Provide the retailer name
    
    Return the information ONLY as a JSON object with this exact structure:
    {{
      "name": "Alternative Product Name",
      "price": 123.45,
      "url": "https://retailer.com/product-page",
      "retailer": "Retailer Name"
    }}
    
    If you can't find a real alternative that's cheaper, return null.
    """
    
    # Use Gemini 2.0 with Search as a tool
    gemini_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    
    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "tools": [
            {
                "google_search": {}
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
            "topP": 0.8
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        logger.info(f"Searching for alternatives to {item_name} (under ${item_cost})")
        resp = requests.post(gemini_url, headers=headers, json=request_body)
        resp.raise_for_status()
        gemini_response = resp.json()
        
        # Extract the response text
        text = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
        
        # Try to extract JSON from the response
        result = extract_json(text)
        
        # Log the search sources if available (for debugging)
        search_sources = []
        if "groundingMetadata" in gemini_response["candidates"][0]:
            grounding = gemini_response["candidates"][0]["groundingMetadata"]
            if "groundingChunks" in grounding:
                search_sources = [chunk.get("web", {}).get("uri", "") for chunk in grounding["groundingChunks"]]
                logger.info(f"Search sources: {search_sources}")
        
        # --------------------------------------------------------------------
        # UPDATED VALIDATION TO HANDLE MISSING PRICE (AROUND LINE 260)
        # --------------------------------------------------------------------
        # Validate the result
        if (
            isinstance(result, dict) and
            "name" in result and 
            "url" in result
        ):
            # Make sure price exists and is a valid number
            if "price" not in result or result["price"] is None:
                # Estimate a price 30% cheaper if none provided
                result["price"] = round(item_cost * 0.7, 2)
                logger.info(f"No price found, estimating price as ${result['price']}")

            if float(result["price"]) < item_cost:
                # Validate and fix URL if needed
                result["url"] = ensure_valid_product_url(result["url"])

                # If we still don't have a valid product URL, try to extract one from search sources
                if not is_product_url(result["url"]) and search_sources:
                    product_urls = [s for s in search_sources if is_product_url(s)]
                    if product_urls:
                        result["url"] = ensure_valid_product_url(product_urls[0])
                        logger.info(f"Replaced with product URL from search sources: {result['url']}")

                # Add retailer if missing
                if "retailer" not in result or not result["retailer"]:
                    try:
                        domain = urlparse(result["url"]).netloc
                        result["retailer"] = domain.replace("www.", "").split(".")[0].title()
                    except:
                        result["retailer"] = "Online Retailer"

                logger.info(f"Found alternative: {result['name']} for ${result['price']} at {result['retailer']}")
                logger.info(f"Product URL: {result['url']}")
                return result
        
        logger.info("No suitable alternative found")
        return None
        
    except Exception as e:
        logger.error(f"Error searching for alternatives with Gemini: {str(e)}")
        return None

def is_product_url(url: str) -> bool:
    """
    Check if a URL is likely to be a product page.
    """
    if not url:
        return False
        
    try:
        parsed = urlparse(url)
        
        # Check for common product URL patterns
        product_indicators = [
            "/p/", "/product/", "/item/", "/dp/", "/shop/", "/buy/", "/ip/",
            "pid=", "product_id=", "productId=", "itemId=", "skuId="
        ]
        
        # Check for known shopping domains
        shopping_domains = [
            "amazon", "walmart", "target", "bestbuy", "ebay", "etsy", 
            "homedepot", "lowes", "wayfair", "newegg", "overstock",
            "costco", "samsclub", "macys", "nordstrom", "kohls"
        ]
        
        # Check if domain contains any shopping domain keywords
        is_shopping_domain = any(shop in parsed.netloc.lower() for shop in shopping_domains)
        
        # Check if path contains any product indicators
        has_product_indicator = any(indicator in parsed.path.lower() or indicator in parsed.query.lower() 
                                    for indicator in product_indicators)
        
        # URLs with "search" or "list" in them are likely search results, not product pages
        is_search_page = "search" in parsed.path.lower() or "list" in parsed.path.lower()
        
        return (is_shopping_domain and has_product_indicator) or (is_shopping_domain and not is_search_page)
    except:
        return False

def ensure_valid_product_url(url: str) -> str:
    """
    Make sure the URL is a valid product URL.
    Fix common issues with URLs provided by AI.
    """
    if not url:
        return ""
        
    # Make sure URL has a scheme
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Remove any URL parameters that might be tracking-related
    # but keep essential parameters like product ID
    try:
        parsed = urlparse(url)
        
        # Keep only essential query parameters (usually product IDs)
        essential_params = ["id", "pid", "product", "item", "p", "productId", "itemId", "skuId", "sku"]
        
        query_params = parse_qsl(parsed.query)
        filtered_params = [(k, v) for k, v in query_params 
                           if any(param in k.lower() for param in essential_params)]
        
        # Rebuild the URL with only essential parameters
        clean_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            urlencode(filtered_params),
            ""  # Remove fragment
        ))
        
        return clean_url
    except:
        # If any errors occur in parsing, return the original URL
        return url

def get_purchase_recommendation(item_name: str, item_cost: float, alternative: dict = None, advanced_data: dict = None) -> dict:
    """
    Generate a buy/don't buy recommendation using the Gemini API.
    
    This version supports alternative product suggestions and advanced data analysis.
    """
    # Build the advanced data section if available
    advanced_context = ""
    if advanced_data:
        advanced_context = "Additional context:\n"
        
        if advanced_data.get("purpose"):
            advanced_context += f"- Purpose of purchase: {advanced_data['purpose']}\n"
        
        if advanced_data.get("frequency"):
            advanced_context += f"- Frequency of use: {advanced_data['frequency']}\n"
        
        if advanced_data.get("lifespan"):
            advanced_context += f"- Expected lifespan: {advanced_data['lifespan']} years\n"
        
        if advanced_data.get("alternativeCost") is not None:
            advanced_context += f"- Cost of alternative option: ${advanced_data['alternativeCost']:.2f}\n"
        
        if advanced_data.get("notes"):
            advanced_context += f"- User notes: {advanced_data['notes']}\n"
    
    # Build the alternative product section if available
    alternative_context = ""
    if alternative:
        alternative_context = f"\nCheaper alternative found:\n"
        alternative_context += f"- Name: {alternative['name']}\n"
        alternative_context += f"- Price: ${alternative['price']:.2f}\n"
        if 'retailer' in alternative:
            alternative_context += f"- Retailer: {alternative['retailer']}\n"
        alternative_context += f"- Savings: ${item_cost - alternative['price']:.2f} ({((item_cost - alternative['price'])/item_cost*100):.1f}%)\n"
    
    prompt = f"""
    As Charlie Munger, the legendary investor and business partner of Warren Buffett, analyze the following purchase decision:

    Item: {item_name}
    Cost: ${item_cost:.2f}
    {advanced_context}
    {alternative_context}

    Provide a clear "Buy" or "Don't Buy" recommendation based on your principles of rational decision-making, opportunity cost, and long-term value.
    
    Consider these factors in your analysis:
    - Whether this item is a necessity or a luxury
    - The frequency of use and utility derived
    - The expected lifespan of the item
    - The opportunity cost of the money spent
    - Whether cheaper alternatives exist that may provide similar utility (especially consider the alternative provided if available)
    - The long-term impact of this purchase on financial goals

    Return ONLY a JSON object with this structure:
    {{
      "decision": "Buy" or "Don't Buy",
      "explanation": "2-3 sentences explaining your recommendation using Charlie Munger's mental models and investment principles"
    }}
    """
    
    gemini_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-pro:generateContent?key={GEMINI_API_KEY}"
    )
    
    request_body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 512,
            "topP": 0.8
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        resp = requests.post(gemini_url, headers=headers, json=request_body)
        resp.raise_for_status()
        gemini_response = resp.json()
        text = gemini_response["candidates"][0]["content"]["parts"][0]["text"]
        result = extract_json(text)
        
        # Ensure we have the expected fields
        if "decision" not in result or "explanation" not in result:
            raise ValueError("Invalid response format")
            
        return result
    
    except Exception as e:
        logger.error(f"Error generating recommendation: {str(e)}")
        return {
            "decision": "Consider carefully",
            "explanation": f"Unable to provide a definitive recommendation for {item_name} due to insufficient information. Consider your personal financial situation and necessity of the purchase."
        }

def extract_json(text: str) -> dict:
    """
    Extract JSON from text response.
    """
    text = text.strip()
    start_idx = text.find("{")
    end_idx = text.rfind("}") + 1
    if start_idx >= 0 and end_idx > start_idx:
        json_str = text[start_idx:end_idx]
        try:
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"Error parsing JSON: {e}, JSON string: {json_str}")
            pass
            
    # If JSON extraction failed, create a default response
    if "buy" in text.lower():
        return {
            "decision": "Buy",
            "explanation": "Based on the available information, this appears to be a reasonable purchase."
        }
    elif "don't buy" in text.lower() or "do not buy" in text.lower():
        return {
            "decision": "Don't Buy",
            "explanation": "Based on the available information, this does not appear to be a worthwhile purchase."
        }
    else:
        return {
            "decision": "Consider carefully",
            "explanation": "Weigh the value of this purchase against your financial goals and needs."
        }
