'use client';

import { useState, useMemo, useCallback } from 'react';
import type { CartItem, Product } from '@/types';

export interface UseCartReturn {
  cart: CartItem[];
  cartMemos: Record<string, string>;
  editingQuantityId: string | null;
  quantityInput: string;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  setCartMemos: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setQuantityInput: React.Dispatch<React.SetStateAction<string>>;
  setEditingQuantityId: React.Dispatch<React.SetStateAction<string | null>>;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  startEditingQuantity: (productId: string, currentQuantity: number) => void;
  saveQuantity: (productId: string) => void;
  cancelEditing: () => void;
  removeFromCart: (productId: string) => void;
  cartTotal: number;
  cartSubtotal: number;
  cartTax: number;
  cartItemCount: number;
}

export default function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartMemos, setCartMemos] = useState<Record<string, string>>({});
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('');

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.reduce<CartItem[]>((acc, item) => {
        if (item.id !== productId) {
          acc.push(item);
          return acc;
        }
        const newQty = item.quantity + delta;
        if (newQty > 0) {
          acc.push({ ...item, quantity: newQty });
        }
        // newQty === 0 이면 삭제 (acc에 push 안 함)
        return acc;
      }, [])
    );
  }, []);

  const startEditingQuantity = useCallback((productId: string, currentQuantity: number) => {
    setEditingQuantityId(productId);
    setQuantityInput(String(currentQuantity));
  }, []);

  const saveQuantity = useCallback((productId: string) => {
    const newQuantity = parseInt(quantityInput, 10);
    if (isNaN(newQuantity) || newQuantity < 1) {
      // 0 이하 입력 시 해당 항목 삭제
      setCart(prev => prev.filter(i => i.id !== productId));
      setEditingQuantityId(null);
      setQuantityInput('');
      return;
    }
    setCart(prev =>
      prev.map(i =>
        i.id === productId ? { ...i, quantity: newQuantity } : i
      )
    );
    setEditingQuantityId(null);
    setQuantityInput('');
  }, [quantityInput]);

  const cancelEditing = useCallback(() => {
    setEditingQuantityId(null);
    setQuantityInput('');
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.id !== productId));
    setCartMemos(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const cartSubtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const cartTax = useMemo(() =>
    Math.round(cartSubtotal * 0.1),
    [cartSubtotal]
  );

  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = cart.reduce((t, item) => t + (item.price * item.quantity * (item.tax_rate || 0.1)), 0);
    return subtotal + tax;
  }, [cart]);

  const cartItemCount = useMemo(() =>
    cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return {
    cart,
    cartMemos,
    editingQuantityId,
    quantityInput,
    setCart,
    setCartMemos,
    setQuantityInput,
    setEditingQuantityId,
    addToCart,
    updateQuantity,
    startEditingQuantity,
    saveQuantity,
    cancelEditing,
    removeFromCart,
    cartTotal,
    cartSubtotal,
    cartTax,
    cartItemCount,
  };
}
