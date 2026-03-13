import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';

export function useStatements() {
  return useQuery({
    queryKey: ['statements'],
    queryFn: api.getStatements,
  });
}

export function useTransactions(params?: Parameters<typeof api.getTransactions>[0]) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => api.getTransactions(params),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.getDashboardSummary,
  });
}

export function useSpending(params?: Parameters<typeof api.getSpending>[0]) {
  return useQuery({
    queryKey: ['spending', params],
    queryFn: () => api.getSpending(params),
  });
}

export function useUploadStatement() {
  return useMutation({
    mutationFn: api.uploadStatement,
  });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.confirmImport,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; category_id: number; category_source?: string }) =>
      api.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
