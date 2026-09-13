import React, { createContext, useContext, useState, } from 'react';












const CartContext = createContext(undefined);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const addToCart = (product, customization) => {
    const measurementSignature = customization.measurements ? JSON.stringify(customization.measurements) : '';
    const id = `${product.id}-${customization.purchaseMode}-${customization.size}-${customization.color}-${customization.suitOption || ''}-${customization.addWaistcoat || ''}-${measurementSignature}`;
    setItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id, product, quantity: 1, customization }];
    });
  };

  const removeFromCart = (id) => setItems(prev => prev.filter(item => item.id !== id));
  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) return removeFromCart(id);
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };
  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    let price = item.product.price;
    if (item.customization.addWaistcoat) price += 3000;
    if (item.customization.suitOption === '2-piece') price *= 0.75;
    if (item.customization.suitOption === 'blazer-only') price *= 0.5;
    if (item.customization.suitOption === 'pants-only') price *= 0.3;
    if (item.customization.purchaseMode === 'unstitched') price *= 0.6;
    return sum + price * item.quantity;
  }, 0);

  return (
    React.createElement(CartContext.Provider, { value: { items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}
      , children
    )
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
