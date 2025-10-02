from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from datetime import datetime
from typing import Dict, List
import uuid

app = FastAPI(title="ISRO MOSDAC Helpbot API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for sessions and messages
sessions: Dict[str, dict] = {}
messages: Dict[str, List[dict]] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_sessions: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_sessions[websocket] = session_id
        
        # Create session if it doesn't exist
        if session_id not in sessions:
            sessions[session_id] = {
                "id": session_id,
                "created_at": datetime.now(),
                "last_active": datetime.now(),
                "context": {}
            }
            messages[session_id] = []

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_sessions:
            del self.connection_sessions[websocket]

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

manager = ConnectionManager()

def generate_response(user_message: str, session_id: str) -> str:
    """Generate AI response based on user message and session context"""
    message_lower = user_message.lower()
    
    # Update session context
    if session_id in sessions:
        sessions[session_id]["last_active"] = datetime.now()
        context = sessions[session_id]["context"]
        
        # Track conversation topics
        if "satellite" in message_lower:
            context["topic"] = "satellite_data"
        elif "download" in message_lower:
            context["topic"] = "download_process"
        elif "help" in message_lower:
            context["topic"] = "general_help"
    
    # Enhanced responses based on keywords and context
    if "hello" in message_lower or "hi" in message_lower or "hey" in message_lower:
        return "Hello! I'm the MOSDAC AI Assistant. I can help you with satellite data, downloads, documentation, and general information about MOSDAC services. What would you like to know?"
    
    elif "satellite" in message_lower and "data" in message_lower:
        return "MOSDAC provides comprehensive satellite data including:\n• Ocean Color data\n• Sea Surface Temperature\n• Chlorophyll concentration\n• Oceanographic parameters\n• Weather satellite imagery\n\nAll data is freely available for research and educational purposes. Would you like information about accessing specific datasets?"
    
    elif "download" in message_lower or "access" in message_lower:
        return "To download satellite data from MOSDAC:\n1. Visit www.mosdac.gov.in\n2. Register for a free account\n3. Browse the data catalog\n4. Select your desired dataset and time range\n5. Download directly or request bulk data\n\nSome datasets may require additional registration. Would you like help with a specific dataset?"
    
    elif "registration" in message_lower or "account" in message_lower:
        return "To register for MOSDAC services:\n1. Go to the MOSDAC portal\n2. Click on 'New User Registration'\n3. Fill in your details and purpose of use\n4. Verify your email\n5. Login with your credentials\n\nRegistration is free and gives you access to all public datasets and some restricted research data."
    
    elif "help" in message_lower or "support" in message_lower:
        return "I can help you with:\n• Finding and downloading satellite data\n• Understanding MOSDAC services\n• Registration and account issues\n• Data formats and processing\n• API access and documentation\n\nFor technical support, you can also contact: nitesh@sac.isro.gov.in or utkarsh@sac.isro.gov.in"
    
    elif "api" in message_lower:
        return "MOSDAC provides REST API access for automated data retrieval:\n• Programmatic data access\n• Bulk download capabilities\n• Integration with analysis tools\n• Documentation available on the portal\n\nAPI access requires registration and approval for certain datasets."
    
    elif "format" in message_lower or "file" in message_lower:
        return "MOSDAC data is available in various formats:\n• NetCDF (Network Common Data Form)\n• HDF (Hierarchical Data Format)\n• GeoTIFF for imagery\n• CSV for tabular data\n• Binary formats for specific sensors\n\nMost scientific data uses NetCDF format which is widely supported by analysis tools."
    
    elif "thank" in message_lower:
        return "You're welcome! I'm here to help with any other questions about MOSDAC satellite data and services. Feel free to ask anything else!"
    
    else:
        return "I can help you with MOSDAC satellite data and services. Some things you can ask me about:\n• Satellite datasets and how to access them\n• Registration and download processes\n• Data formats and file types\n• API access and documentation\n• General MOSDAC services\n\nWhat specific information are you looking for?"

@app.get("/")
async def root():
    return {
        "message": "ISRO MOSDAC Helpbot API is running!",
        "version": "1.0.0",
        "endpoints": {
            "websocket": "/ws/{session_id}",
            "health": "/health"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "active_sessions": len(sessions),
        "active_connections": len(manager.active_connections)
    }

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    
    try:
        # Send welcome message
        welcome_msg = {
            "id": str(uuid.uuid4()),
            "message": "Connected to MOSDAC AI Assistant! How can I help you today?",
            "type": "bot",
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_message(welcome_msg, websocket)
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")
            
            # Store user message
            user_msg = {
                "id": str(uuid.uuid4()),
                "message": user_message,
                "type": "user",
                "timestamp": datetime.now().isoformat()
            }
            messages[session_id].append(user_msg)
            
            # Generate response
            response_text = generate_response(user_message, session_id)
            
            # Store bot response
            bot_msg = {
                "id": str(uuid.uuid4()),
                "message": response_text,
                "type": "bot",
                "timestamp": datetime.now().isoformat()
            }
            messages[session_id].append(bot_msg)
            
            # Send response back to client
            await manager.send_message(bot_msg, websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/sessions/{session_id}/messages")
async def get_message_history(session_id: str):
    """Get message history for a session"""
    return {
        "session_id": session_id,
        "messages": messages.get(session_id, []),
        "session_info": sessions.get(session_id, {})
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting ISRO MOSDAC Helpbot API...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)