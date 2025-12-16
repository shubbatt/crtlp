import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/currency';
import './PaymentModal.css';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (paymentData: PaymentData) => void | Promise<void>;
    amount: number; // Amount due/outstanding
    orderNumber?: string;
    title?: string;
    subtitle?: string;
    showPayLater?: boolean;
    onPayLater?: () => void | Promise<void>;
    showProductionToggle?: boolean;
    requiresProduction?: boolean;
    onProductionToggle?: (requires: boolean) => void;
    payLaterButtonText?: string;
    submitButtonText?: string;
    disabled?: boolean;
}

export interface PaymentData {
    method: 'cash' | 'card' | 'transfer';
    amount: number;
    bank?: string;
    reference_number?: string;
}

const cardTypes = ['POS', 'Scan'];
const banks = ['Bank of Maldives', 'Maldives Islamic Bank', 'State Bank of India', 'MIB', 'BML'];

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    amount,
    orderNumber,
    title = 'Record Payment',
    subtitle,
    showPayLater = false,
    onPayLater,
    showProductionToggle = false,
    requiresProduction = false,
    onProductionToggle,
    payLaterButtonText = 'Pay Later',
    submitButtonText = 'Pay Now & Complete',
    disabled = false
}) => {
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [selectedBank, setSelectedBank] = useState<string>('');
    const [referenceNumber, setReferenceNumber] = useState<string>('');

    // Reset form when modal closes or opens
    useEffect(() => {
        if (!isOpen) {
            setPaymentMethod('cash');
            setPaymentAmount('');
            setSelectedBank('');
            setReferenceNumber('');
        } else {
            // Set default amount for cash payments
            if (paymentMethod === 'cash') {
                setPaymentAmount(amount.toString());
            }
        }
    }, [isOpen, amount, paymentMethod]);

    const handleClose = () => {
        setPaymentMethod('cash');
        setPaymentAmount('');
        setSelectedBank('');
        setReferenceNumber('');
        onClose();
    };

    const handleMethodChange = (method: 'cash' | 'card' | 'transfer') => {
        setPaymentMethod(method);
        setSelectedBank('');
        setReferenceNumber('');
        if (method === 'cash') {
            setPaymentAmount(amount.toString());
        } else {
            setPaymentAmount('');
        }
    };

    const handleSubmit = async () => {
        const paymentData: PaymentData = {
            method: paymentMethod,
            amount: paymentMethod === 'cash' ? Number(paymentAmount || amount) : amount,
            bank: selectedBank || undefined,
            reference_number: referenceNumber || undefined
        };

        await onSubmit(paymentData);
    };

    const isValid = (): boolean => {
        if (paymentMethod === 'cash') {
            return Number(paymentAmount || 0) >= amount;
        } else {
            return !!selectedBank && !!referenceNumber.trim();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="payment-modal-overlay" onClick={handleClose}>
            <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                <button 
                    className="payment-modal-close"
                    onClick={handleClose}
                    title="Close"
                >
                    ×
                </button>

                <div className="payment-header">
                    <span className="success-icon">💵</span>
                    <h2>{title}</h2>
                    {orderNumber && <p className="order-ref">{orderNumber}</p>}
                    {subtitle && <p className="payment-subtitle">{subtitle}</p>}
                </div>

                <div className="payment-amount-display">
                    <span>{paymentMethod === 'cash' ? 'Amount Due' : 'Outstanding Balance'}</span>
                    <span className="amount">{formatCurrency(amount)}</span>
                </div>

                <div className="payment-methods">
                    <h3>Select Payment Method</h3>
                    <div className="method-buttons">
                        <button
                            className={`method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                            onClick={() => handleMethodChange('cash')}
                        >
                            💵 Cash
                        </button>
                        <button
                            className={`method-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                            onClick={() => handleMethodChange('card')}
                        >
                            💳 Card
                        </button>
                        <button
                            className={`method-btn ${paymentMethod === 'transfer' ? 'active' : ''}`}
                            onClick={() => handleMethodChange('transfer')}
                        >
                            🏦 Transfer
                        </button>
                    </div>
                </div>

                {/* Card Type Selection for Card Payment */}
                {paymentMethod === 'card' && (
                    <div className="payment-input">
                        <label>Payment Type *</label>
                        <select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            className="bank-select"
                            required
                        >
                            <option value="">-- Select Type --</option>
                            {cardTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Bank Selection for Transfer Payment */}
                {paymentMethod === 'transfer' && (
                    <div className="payment-input">
                        <label>Select Bank *</label>
                        <select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            className="bank-select"
                            required
                        >
                            <option value="">-- Select Bank --</option>
                            {banks.map((bank) => (
                                <option key={bank} value={bank}>
                                    {bank}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Reference Number for Card/Transfer */}
                {(paymentMethod === 'card' || paymentMethod === 'transfer') && selectedBank && (
                    <div className="payment-input">
                        <label>Reference Number *</label>
                        <input
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder={paymentMethod === 'card' ? 'Enter transaction/authorization number' : 'Enter bank transfer reference number'}
                            required
                        />
                        <small className="input-hint">
                            {paymentMethod === 'card' 
                                ? 'Enter card authorization/transaction number'
                                : 'Enter bank transfer reference number'}
                        </small>
                    </div>
                )}

                {/* Amount Received - Only show for cash payments */}
                {paymentMethod === 'cash' && (
                    <div className="payment-input">
                        <label>Amount Received</label>
                        <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            step="0.01"
                            min={amount}
                        />
                        {Number(paymentAmount) > amount && (
                            <div className="change-due">
                                Change: {formatCurrency(Number(paymentAmount) - amount)}
                            </div>
                        )}
                        {paymentAmount && Number(paymentAmount) > 0 && Number(paymentAmount) < amount && (
                            <div className="change-due" style={{ color: '#ef4444' }}>
                                ⚠️ Amount is less than due amount
                            </div>
                        )}
                    </div>
                )}

                {/* Display total amount for card/transfer payments */}
                {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
                    <div className="payment-input">
                        <label>Payment Amount</label>
                        <div className="payment-amount-display">
                            {formatCurrency(amount)}
                        </div>
                        <small className="input-hint">
                            Full amount will be charged
                        </small>
                    </div>
                )}

                {/* Production Toggle */}
                {showProductionToggle && onProductionToggle && (
                    <div className="production-toggle">
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={requiresProduction}
                                onChange={(e) => onProductionToggle(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                        <div className="toggle-label">
                            <span className="toggle-title">
                                {requiresProduction ? '📦 Send to Production' : '✅ Ready for Pickup'}
                            </span>
                            <span className="toggle-desc">
                                {requiresProduction
                                    ? 'Order will be queued for production'
                                    : 'Skip production - deliver immediately'}
                            </span>
                        </div>
                    </div>
                )}

                <div className="payment-actions">
                    {showPayLater && onPayLater && (
                        <button className="btn-skip" onClick={onPayLater}>
                            ⏳ {payLaterButtonText}
                        </button>
                    )}
                    <button
                        className="btn-complete"
                        onClick={handleSubmit}
                        disabled={disabled || !isValid()}
                    >
                        ✅ {submitButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
