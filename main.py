import os
import json
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import google.generativeai as genai
from PIL import Image

# Change this back to safely grab a hidden key:
api_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=api_key)

model = genai.GenerativeModel(
    'gemini-2.5-flash',
    generation_config={"response_mime_type": "application/json"}
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- THESE ROUTES SERVE YOUR FRONTEND UI ---
@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.get("/style.css")
def read_css():
    return FileResponse("style.css")

@app.get("/script.js")
def read_js():
    return FileResponse("script.js")

# --- THIS ROUTE HANDLES THE AI SCANNING ---
@app.post("/analyze-label")
async def analyze_label(file: UploadFile = File(...)):
    try:
        # Read directly from memory for speed
        img = Image.open(file.file)

        prompt = """
        You are a highly advanced nutritionist analyzing Indian food package labels.
        Extract the macros. Rate the product as 'Green' (Healthy), 'Amber' (Moderate), or 'Red' (Unhealthy).
        Identify any harmful ingredients.
        
        CRITICAL SPEED RULE: Be incredibly concise. Keep 'rating_reason', 'issue', and 'detail' fields to an absolute maximum of 12 words each. Do not write paragraphs. Focus on instant readability.
        
        For 'healthy_alternatives', provide 2 highly specific, easily accessible whole-food Indian alternatives (e.g., local street food swaps, millets, regional fresh snacks).

        Format required:
        {
          "product_name": "Name of the product from the label",
          "macros": {"protein_g": 0, "carbs_g": 0, "fats_g": 0, "sugar_g": 0},
          "rating": "Red | Amber | Green",
          "rating_reason": "One simple sentence explaining the rating.",
          "red_flags": [{"ingredient": "Name", "issue": "Short explanation."}],
          "healthy_alternatives": [
            {
              "name": "Specific Local Food Name",
              "detail": "A very short explanation of why this is better."
            }
          ]
        }
        """

        gemini_response = await model.generate_content_async([prompt, img])
        img.close()
        
        clean_data = json.loads(gemini_response.text.strip())
        
        return {
            "status": "success",
            "data": clean_data
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": "Failed to parse label.",
            "error_details": str(e)
        }