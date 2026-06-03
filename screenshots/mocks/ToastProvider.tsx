import React from 'react';

const api = new Proxy({}, { get: () => () => {} });

export const useToast = () => api as any;
export const useFeedback = () => api as any;
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const ToastProvider = FeedbackProvider;
export default { useToast, useFeedback, ToastProvider, FeedbackProvider };
