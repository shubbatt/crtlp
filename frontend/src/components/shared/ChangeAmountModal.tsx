import React from 'react';
import { formatCurrency } from '../../utils/currency';
import './ChangeAmountModal.css';

interface ChangeAmountModalProps {
    isOpen: boolean;
    onClose: () => void;
    changeAmount: number;
}

const ChangeAmountModal: React.FC<ChangeAmountModalProps> = ({
    isOpen,
    onClose,
    changeAmount
}) => {
    if (!isOpen) return null;

    return (
        <div className="change-modal-overlay" onClick={onClose}>
            <div className="change-modal" onClick={(e) => e.stopPropagation()}>
                <div className="change-icon-large">💰</div>
                <div className="change-label">Change Amount</div>
                <div className="change-amount-large">{formatCurrency(changeAmount)}</div>
                <button 
                    className="change-close-btn"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default ChangeAmountModal;
