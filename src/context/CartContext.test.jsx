/**
 * CartContext tests
 *
 * Pricing math source of truth (CartContext.jsx lines 39-47):
 * 1. Start with item.product.price
 * 2. addWaistcoat   → +3000  (flat)
 * 3. suitOption '2-piece'      → *0.75
 * 4. suitOption 'blazer-only'  → *0.5
 * 5. suitOption 'pants-only'   → *0.3
 * 6. purchaseMode 'unstitched' → *0.6
 * 7. multiply by quantity
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';
import React from 'react';

const wrapper = ({ children }) => React.createElement(CartProvider, null, children);

const makeProduct = (price = 10000) => ({
  id: 'prod-shirt',
  name: 'Classic Shirt',
  price,
});

const makeCustomization = (overrides = {}) => ({
  purchaseMode: 'readymade',
  size: 'M',
  color: 'blue',
  ...overrides,
});

describe('CartContext pricing', () => {
  it('base, no modifiers → 10000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization());
    });
    expect(result.current.totalPrice).toBe(10000);
  });

  it('Waistcoat → 13000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization({ addWaistcoat: true }));
    });
    expect(result.current.totalPrice).toBe(13000);
  });

  it('2-piece → 7500', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization({ suitOption: '2-piece' }));
    });
    expect(result.current.totalPrice).toBe(7500);
  });

  it('Blazer-only → 5000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization({ suitOption: 'blazer-only' }));
    });
    expect(result.current.totalPrice).toBe(5000);
  });

  it('Pants-only → 3000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization({ suitOption: 'pants-only' }));
    });
    expect(result.current.totalPrice).toBe(3000);
  });

  it('Unstitched → 6000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(10000), makeCustomization({ purchaseMode: 'unstitched' }));
    });
    expect(result.current.totalPrice).toBe(6000);
  });

  it('Waistcoat + 2-piece + unstitched → 5850 ((10000+3000) × 0.75 × 0.6)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(
        makeProduct(10000),
        makeCustomization({ addWaistcoat: true, suitOption: '2-piece', purchaseMode: 'unstitched' })
      );
    });
    // Math: (10000 + 3000) * 0.75 * 0.6 = 13000 * 0.75 * 0.6 = 5850
    expect(result.current.totalPrice).toBe(5850);
  });

  it('Adding same customization twice → quantity 2, totalPrice 20000', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = makeProduct(10000);
    const customization = makeCustomization();
    act(() => {
      result.current.addToCart(product, customization);
      result.current.addToCart(product, customization);
    });
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(20000);
    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('Adding different colours → 2 line items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = makeProduct(10000);
    act(() => {
      result.current.addToCart(product, makeCustomization({ color: 'blue' }));
      result.current.addToCart(product, makeCustomization({ color: 'red' }));
    });
    expect(result.current.totalItems).toBe(2);
    expect(result.current.items.length).toBe(2);
  });
});

describe('CartContext actions', () => {
  it('removeFromCart removes item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(), makeCustomization({ color: 'blue' }));
    });
    const id = result.current.items[0].id;
    act(() => {
      result.current.removeFromCart(id);
    });
    expect(result.current.items.length).toBe(0);
    expect(result.current.totalItems).toBe(0);
  });

  it('updateQuantity changes quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(5000), makeCustomization());
    });
    const id = result.current.items[0].id;
    act(() => {
      result.current.updateQuantity(id, 3);
    });
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.totalPrice).toBe(15000);
  });

  it('updateQuantity to 0 removes item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(), makeCustomization());
    });
    const id = result.current.items[0].id;
    act(() => {
      result.current.updateQuantity(id, 0);
    });
    expect(result.current.items.length).toBe(0);
  });

  it('clearCart empties the cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addToCart(makeProduct(), makeCustomization());
      result.current.addToCart(makeProduct(), makeCustomization({ color: 'red' }));
      result.current.clearCart();
    });
    expect(result.current.items.length).toBe(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });
});
