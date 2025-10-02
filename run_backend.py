import subprocess
import sys
import os

# Change to the backend directory
backend_dir = r"C:\Users\user\aichatbot\isro-helpbot\backend"
os.chdir(backend_dir)

# Try to run with uvicorn
try:
    # Install missing dependencies
    subprocess.run([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn[standard]"], check=True)
    
    # Create a simple app
    with open("simple_app.py", "w") as f:
        f.write('''
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "ISRO MOSDAC Helpbot Backend is running!"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
''')
    
    # Run the app
    subprocess.run([sys.executable, "simple_app.py"])
    
except Exception as e:
    print(f"Error: {e}")