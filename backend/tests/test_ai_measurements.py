import pytest
from unittest.mock import MagicMock, patch
from fastapi import status
from app.config import settings

# Sample base64 data for testing
B64_FRONT = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
B64_SIDE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

def test_extract_without_auth_fails(client):
    response = client.post(
        "/api/measurements/extract",
        json={
            "front_image_base64": B64_FRONT,
            "side_image_base64": B64_SIDE,
            "gender": "male",
            "height_cm": 180.0
        }
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_extract_endpoint_returns_503_when_no_api_key(client, customer_token, auth_headers):
    # Temporarily remove GEMINI_API_KEY
    with patch.object(settings, "GEMINI_API_KEY", None):
        response = client.post(
            "/api/measurements/extract",
            json={
                "front_image_base64": B64_FRONT,
                "side_image_base64": B64_SIDE,
                "gender": "male",
                "height_cm": 180.0
            },
            headers=auth_headers(customer_token)
        )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "not configured" in response.json()["detail"].lower()


@patch("google.genai.Client")
def test_extract_endpoint_success(mock_client_class, client, customer_token, auth_headers):
    # Ensure GEMINI_API_KEY is active
    with patch.object(settings, "GEMINI_API_KEY", "dummy-key"):
        # Setup mock client
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        # Setup mock response
        mock_response = MagicMock()
        mock_response.text = """
        {
          "shoulder": 18.2,
          "chest": 40.1,
          "waist": 34.0,
          "hip": 38.5,
          "neck": 15.5,
          "sleeveLength": 24.3,
          "shirtLength": 28.0,
          "inseam": 31.0,
          "confidence": "high",
          "notes": ["Clear photos", "Fitted shirt detected"]
        }
        """
        mock_client.models.generate_content.return_value = mock_response

        response = client.post(
            "/api/measurements/extract",
            json={
                "front_image_base64": B64_FRONT,
                "side_image_base64": B64_SIDE,
                "gender": "male",
                "height_cm": 180.0
            },
            headers=auth_headers(customer_token)
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Rounding logic verification (18.2 rounds to 18.0; 24.3 rounds to 24.5; 38.5 stays 38.5)
        measurements = data["measurements"]
        assert measurements["shoulder"] == 18.0
        assert measurements["chest"] == 40.0
        assert measurements["waist"] == 34.0
        assert measurements["hip"] == 38.5
        assert measurements["neck"] == 15.5
        assert measurements["sleeveLength"] == 24.5
        assert measurements["shirtLength"] == 28.0
        assert measurements["inseam"] == 31.0
        
        assert data["confidence"] == "high"
        # The endpoint should append the verification warning note automatically
        assert "These are AI estimates" in data["notes"][-1]
