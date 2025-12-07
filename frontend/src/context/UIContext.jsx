import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaCheck, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm' });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const confirmAction = useCallback((message, onConfirm, title = 'Confirm Action') => {
        setModal({
            isOpen: true,
            title,
            message,
            onConfirm: async () => {
                await onConfirm();
                setModal(prev => ({ ...prev, isOpen: false }));
            },
            type: 'confirm'
        });
    }, []);

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    return (
        <UIContext.Provider value={{ showToast, confirmAction }}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {modal.isOpen && (
                <Modal
                    title={modal.title}
                    message={modal.message}
                    onConfirm={modal.onConfirm}
                    onCancel={closeModal}
                />
            )}
        </UIContext.Provider>
    );
};

const Toast = ({ message, type, onClose }) => {
    const bgColors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-600'
    };

    const icons = {
        success: <FaCheck />,
        error: <FaExclamationTriangle />,
        info: <FaInfoCircle />,
        warning: <FaExclamationTriangle />
    };

    return createPortal(
        <div className={`fixed bottom-24 right-8 z-[100] ${bgColors[type] || 'bg-gray-800'} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 animate-slide-in`}>
            {icons[type]}
            <span className="font-medium">{message}</span>
            <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-2">
                <FaTimes />
            </button>
        </div>,
        document.body
    );
};

const Modal = ({ title, message, onConfirm, onCancel }) => {
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#282828] text-white rounded-xl shadow-2xl max-w-md w-full border border-gray-700 transform transition-all scale-100">
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-bold">{title}</h3>
                </div>
                <div className="p-6">
                    <p className="text-gray-300">{message}</p>
                </div>
                <div className="p-6 flex justify-end gap-3 bg-[#202020] rounded-b-xl">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-full font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 rounded-full font-bold bg-green-500 text-black hover:scale-105 transition-transform"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
