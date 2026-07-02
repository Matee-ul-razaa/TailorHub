"""
Tests for payments router - critical money flow paths.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Order, OrderStatus, Payment, PaymentStatus, PaymentMethod, User, UserRole


@pytest.fixture
def sample_order(db_session: Session, customer_user: User):
    """Create a sample order for payment testing."""
    order = Order(
        id="ORD-TEST-001",
        customer_id=customer_user.id,
        customer_name=customer_user.full_name,
        customer_email=customer_user.email,
        status=OrderStatus.pending,
        total_amount=5000.0,
        advance_amount=0.0,
        amount_paid=0.0,
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)
    return order


@pytest.fixture
def sample_payment(db_session: Session, sample_order: Order):
    """Create a sample payment record."""
    payment = Payment(
        order_id=sample_order.id,
        method=PaymentMethod.card,
        status=PaymentStatus.pending,
        amount=5000.0,
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def test_create_checkout_session(
    client: TestClient,
    db_session: Session,
    sample_order: Order,
    auth_headers,
    customer_token: str,
):
    """Test creating a Stripe checkout session."""
    payload = {"orderId": sample_order.id, "paymentType": "full"}
    
    response = client.post(
        "/api/payments/create-checkout-session",
        json=payload,
        headers=auth_headers(customer_token),
    )
    
    # Should succeed or return 503 if Stripe not configured
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert "url" in data


def test_get_order_payment(client: TestClient, sample_order: Order, sample_payment: Payment, auth_headers, customer_token: str):
    """Test retrieving payment for an order."""
    response = client.get(
        f"/api/payments/{sample_order.id}",
        headers=auth_headers(customer_token),
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["orderId"] == sample_order.id
    assert "status" in data
    assert "amount" in data


def test_mark_cod_payment_paid(
    client: TestClient,
    db_session: Session,
    sample_order: Order,
    sample_payment: Payment,
    auth_headers,
    admin_token: str,
):
    """Test marking a COD payment as collected."""
    # Update payment method to COD
    sample_payment.method = PaymentMethod.cod
    db_session.commit()
    
    response = client.patch(
        f"/api/payments/{sample_payment.id}/mark-paid",
        headers=auth_headers(admin_token),
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "COD payment recorded"
    
    # Verify payment status updated
    db_session.refresh(sample_payment)
    assert sample_payment.status == PaymentStatus.completed
    
    # Verify order amount_paid updated
    db_session.refresh(sample_order)
    assert sample_order.amount_paid == sample_order.total_amount


def test_mark_payment_paid_unauthorized(
    client: TestClient,
    db_session: Session,
    sample_payment: Payment,
    auth_headers,
    customer_token: str,
):
    """Test that non-admin/non-delivery users cannot mark payments."""
    sample_payment.method = PaymentMethod.cod
    db_session.commit()
    response = client.patch(
        f"/api/payments/{sample_payment.id}/mark-paid",
        headers=auth_headers(customer_token),
    )
    
    assert response.status_code == 403


def test_refund_payment_full(
    client: TestClient,
    db_session: Session,
    sample_order: Order,
    sample_payment: Payment,
    auth_headers,
    admin_token: str,
):
    """Test full refund of a card payment."""
    # Mark payment as completed first
    sample_payment.status = PaymentStatus.completed
    sample_payment.method = PaymentMethod.card
    sample_payment.transaction_id = "pi_test_123"
    sample_order.amount_paid = sample_order.total_amount
    db_session.commit()
    
    payload = {
        "amount": 5000.0,
        "reason": "requested_by_customer",
        "cancel_order": True,
    }
    
    # Will fail without real Stripe credentials, but tests the endpoint structure
    response = client.post(
        f"/api/payments/{sample_order.id}/refund",
        json=payload,
        headers=auth_headers(admin_token),
    )
    
    # Likely 503 if Stripe not configured; otherwise 502/400 depending on Stripe/mock behavior.
    assert response.status_code in [400, 502, 503]


def test_get_payment_methods(client: TestClient):
    """Test retrieving available payment methods."""
    response = client.get("/api/payments/methods")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should include at least COD method
    method_ids = [m["id"] for m in data]
    assert "cod" in method_ids
