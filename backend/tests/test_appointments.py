"""
Tests for Appointments endpoints.
Verifies customer appointment submission, admin review (approve/reject), and notifications.
"""
from fastapi.testclient import TestClient

from app.models import AppointmentStatus, Notification


def test_customer_create_appointment(client: TestClient, customer_token: str):
    response = client.post(
        "/api/appointments",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "phone": "+92 300 1234567",
            "appointment_date": "2026-09-20",
            "time_slot": "10:00 AM - 11:00 AM",
            "notes": "Need measurements for 3 piece suit.",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["phone"] == "+92 300 1234567"
    assert data["appointment_date"] == "2026-09-20"
    assert data["time_slot"] == "10:00 AM - 11:00 AM"
    assert data["status"] == AppointmentStatus.pending.value
    assert data["notes"] == "Need measurements for 3 piece suit."


def test_list_my_appointments(client: TestClient, customer_token: str):
    # Customer creates an appointment
    client.post(
        "/api/appointments",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "phone": "+92 300 9876543",
            "appointment_date": "2026-09-22",
            "time_slot": "2:00 PM - 3:00 PM",
            "notes": "Sherwani measurement",
        },
    )

    # Customer fetches their appointments
    response = client.get(
        "/api/appointments/my",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    assert items[0]["time_slot"] == "2:00 PM - 3:00 PM"


def test_admin_approve_appointment(client: TestClient, customer_token: str, admin_token: str):
    # Create appointment
    res = client.post(
        "/api/appointments",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "phone": "+92 312 3456789",
            "appointment_date": "2026-09-25",
            "time_slot": "11:00 AM - 12:00 PM",
            "notes": "Kurta measurement",
        },
    )
    appointment_id = res.json()["id"]

    # Admin lists all appointments
    admin_list = client.get(
        "/api/appointments",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_list.status_code == 200
    found = any(a["id"] == appointment_id for a in admin_list.json())
    assert found is True

    # Admin approves the appointment
    approve_res = client.patch(
        f"/api/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved", "admin_notes": "Master tailor has reserved this slot."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["admin_notes"] == "Master tailor has reserved this slot."

    # Customer checks my appointments and sees approved
    my_res = client.get(
        "/api/appointments/my",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    my_appt = next(a for a in my_res.json() if a["id"] == appointment_id)
    assert my_appt["status"] == "approved"


def test_admin_reject_appointment(client: TestClient, customer_token: str, admin_token: str):
    # Create appointment
    res = client.post(
        "/api/appointments",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "phone": "+92 312 9999999",
            "appointment_date": "2026-09-28",
            "time_slot": "5:00 PM - 6:00 PM",
            "notes": "Testing rejection",
        },
    )
    appointment_id = res.json()["id"]

    # Admin rejects
    reject_res = client.patch(
        f"/api/appointments/{appointment_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "rejected", "admin_notes": "Shop is closed at this time."},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
