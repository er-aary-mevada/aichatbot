from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "ISRO MOSDAC Helpbot Backend is running!"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")
            
            # Simple response logic
            response = get_response(user_message)
            
            # Send response back to client
            await websocket.send_text(json.dumps({
                "message": response,
                "type": "bot"
            }))
            
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()

def get_response(message: str) -> str:
    """Generate simple responses based on keywords"""
    message_lower = message.lower()
    
    if "satellite" in message_lower or "data" in message_lower:
        return "MOSDAC provides free access to satellite data and services. You can find various satellite datasets including ocean color, sea surface temperature, and other oceanographic parameters."
    elif "download" in message_lower or "access" in message_lower:
        return "You can access and download satellite data from the MOSDAC portal at www.mosdac.gov.in. Registration may be required for certain datasets."
    elif "help" in message_lower or "support" in message_lower:
        return "For support and assistance, you can contact the MOSDAC team through the portal's contact section or refer to the documentation and FAQs available on the website."
    elif "hello" in message_lower or "hi" in message_lower:
        return "Hello! I'm the MOSDAC AI Assistant. I can help you with information about satellite data, downloads, and MOSDAC services. What would you like to know?"
    else:
        return "I'm here to help you with MOSDAC satellite data and services. You can ask me about satellite data, downloads, or general information about MOSDAC services."

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)