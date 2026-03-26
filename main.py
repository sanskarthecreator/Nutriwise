import os
import shutil
import json
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import google.generativeai as genai
from PIL import Image

# --- 1. SETUP GEMINI AI ---
genai.configure(api_key="YOUR_API_KEY_HERE")

# THIS FIXES THE UNDEFINED ERROR: Forces Gemini to only speak in JSON format
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

@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.post("/analyze-label")
async def analyze_label(file: UploadFile = File(...)):
    
    file_location = f"temp_{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        img = Image.open(file_location)

        prompt = """
        You are a helpful nutritionist speaking to everyday people in India. 
        Look at this image of an Indian food package label.
        Extract the macros. Rate the product as 'Green' (Healthy), 'Amber' (Moderate), or 'Red' (Unhealthy).
        Identify any harmful ingredients.
        
        Keep your explanations VERY simple and short so anyone can understand.
        Suggest 1 to 2 overall healthy, whole-food Indian alternatives to this type of packaged food.

        Format required:
        {
          "macros": {
            "protein_g": 0,
            "carbs_g": 0,
            "fats_g": 0,
            "sugar_g": 0
          },
          "rating": "Red | Amber | Green",
          "rating_reason": "One simple sentence explaining the rating.",
          "red_flags": [
            {
              "ingredient": "Name of bad ingredient",
              "issue": "One very simple, short sentence explaining why it is bad."
            }
          ],
          "healthy_alternatives": [
            "Alternative snack 1",
            "Alternative snack 2"
          ]
        }
        """

        gemini_response = model.generate_content([prompt, img])
        img.close()
        
        clean_data = json.loads(gemini_response.text.strip())
        
        if os.path.exists(file_location):
            os.remove(file_location)

        return {
            "status": "success",
            "data": clean_data
        }
        
    except Exception as e:
        try:
            img.close()
        except:
            pass
        if os.path.exists(file_location):
            os.remove(file_location)
            
        return {
            "status": "error",
            "message": "Failed to parse label.",
            "error_details": str(e)
        }