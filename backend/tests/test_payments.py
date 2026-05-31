"""
Tests for payments router - critical money flow paths.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, Payment, PaymentStatus, PaymentMethod, User, UserRole
from app.database import get_db


@pytest.fixture
def sample_order(db: Session, test_customer: User):
    """Create a sample order for payment testing."""
    order = Order(
        id="ORD-TEST-001",
        customer_id=test_customer.id,
        customer_name=test_customer.full_name,
        customer_email=test_customer.email,
        status=OrderStatus.pending,
        total_amount=5000.0,
        advance_amount=0.0,
        amount_paid=0.0,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@pytest.fixture
def sample_payment(db: Session, sample_order: Order):
    """Create a sample payment record."""
    payment = Payment(
        order_id=sample_order.id,
        method=PaymentMethod.card,
        status=PaymentStatus.pending,
        amount=5000.0,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def test_create_payment_intent(client: TestClient, db: Session, sample_order: Order, admin_headers: dict):
    """Test creating a Stripe payment intent."""
    payload = {
        "order_id": sample_order.id,
        "payment_type": "full",
    }
    
    response = client.post(
        "/api/payments/intent",
        json=payload,
        headers=admin_headers,
    )
    
    # Should succeed or return 503 if Stripe not configured
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert "client_secret" in data
        assert "publishable_key" in data


def test_get_order_payment_status(client: TestClient, sample_order: Order, sample_payment: Payment, admin_headers: dict):
    """Test retrieving payment status for an order."""
    response = client.get(
        f"/api/payments/order/{sample_order.id}",
        headers=admin_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["order_id"] == sample_order.id
    assert "status" in data
    assert "amount" in data


def test_mark_cod_payment_paid(
    client: TestClient,
    db: Session,
    sample_order: Order,
    sample_payment: Payment,
    admin_headers: dict,
):
    """Test marking a COD payment as collected."""
    # Update payment method to COD
    sample_payment.method = PaymentMethod.cod
    db.commit()
    
    response = client.patch(
        f"/api/payments/{sample_payment.id}/mark-paid",
        headers=admin_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "COD payment recorded"
    
    # Verify payment status updated
    db.refresh(sample_payment)
    assert sample_payment.status == PaymentStatus.completed
    
    # Verify order amount_paid updated
    db.refresh(sample_order)
    assert sample_order.amount_paid == sample_order.total_amount


def test_mark_payment_paid_unauthorized(
    client: TestClient,
    db: Session,
    sample_payment: Payment,
    customer_headers: dict,
):
    """Test that non-admin/non-delivery users cannot mark payments."""
    response = client.patch(
        f"/api/payments/{sample_payment.id}/mark-paid",
        headers=customer_headers,
    )
    
    assert response.status_code == 403


def test_refund_payment_full(
    client: TestClient,
    db: Session,
    sample_order: Order,
    sample_payment: Payment,
    admin_headers: dict,
):
    """Test full refund of a card payment."""
    # Mark payment as completed first
    sample_payment.status = PaymentStatus.completed
    sample_payment.method = PaymentMethod.card
    sample_payment.transaction_id = "pi_test_123"
    sample_order.amount_paid = sample_order.total_amount
    db.commit()
    
    payload = {
        "amount": 5000.0,
        "reason": "requested_by_customer",
        "cancel_order": True,
    }
    
    # Will fail without real Stripe credentials, but tests the endpoint structure
    response = client.post(
        f"/api/payments/{sample_order.id}/refund",
        json=payload,
        headers=admin_headers,
    )
    
    # Should return 502 (Stripe error) or 400 (payment method/card only check)
    assert response.status_code in [400, 502]


def test_get_payment_methods(client: TestClient):
    """Test retrieving available payment methods."""
    response = client.get("/api/payments/methods")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should include at least COD method
    method_ids = [m["id"] for m in data]
    assert "cod" in method_ids
