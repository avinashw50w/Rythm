from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend import database, models, auth
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
import os

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

class GoogleLogin(BaseModel):
    token: str

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "mock-client-id")

@router.post("/google")
async def google_login(login_data: GoogleLogin, db: Session = Depends(database.get_db)):
    print(f"Received login attempt with token: {login_data.token[:10]}...")
    try:
        # Verify the token
        print(f"Verifying with Client ID: {GOOGLE_CLIENT_ID}")
        idinfo = id_token.verify_oauth2_token(login_data.token, requests.Request(), GOOGLE_CLIENT_ID)
        print(f"Token verified. User email: {idinfo['email']}")
        
        email = idinfo['email']
        name = idinfo.get('name', '')
        avatar_url = idinfo.get('picture', '')

        # Check if user exists
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email, name=name, avatar_url=avatar_url)
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Create tokens
        access_token = auth.create_access_token(data={"sub": user.email})
        refresh_token = auth.create_refresh_token(data={"sub": user.email})
        
        return {
            "access_token": access_token, 
            "refresh_token": refresh_token,
            "token_type": "bearer", 
            "user": {"name": user.name, "email": user.email, "avatar_url": user.avatar_url, "id": user.id}
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token")

class RefreshToken(BaseModel):
    refresh_token: str

@router.post("/refresh")
async def refresh_token(token_data: RefreshToken, db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token_data.refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise credentials_exception
            
        # Verify user exists
        user = db.query(models.User).filter(models.User.email == email).first()
        if user is None:
            raise credentials_exception
            
        # Create new access token
        access_token = auth.create_access_token(data={"sub": email})
        return {"access_token": access_token, "token_type": "bearer"}
        
    except auth.JWTError:
        raise credentials_exception
