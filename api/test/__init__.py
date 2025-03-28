# Create a proper __init__.py file in the api/test directory
# This content is currently incorrectly in a file called function.json

import json
import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Simple test endpoint to verify API connectivity.
    """
    return func.HttpResponse(
        json.dumps({
            "status": "success", 
            "message": "API is working!",
            "features": [
                "Image identification",
                "Cost analysis",
                "Alternative product search",
                "Munger-style recommendations"
            ]
        }),
        status_code=200,
        mimetype="application/json"
    )
