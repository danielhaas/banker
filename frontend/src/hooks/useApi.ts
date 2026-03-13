import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/client';

export function useStatements() {
  return useQuery({
    queryKey: ['statements'],
    queryFn: api.getStatements,
  });
}

export function useStatementCoverage() {
  return useQuery({
    queryKey: ['statement-coverage'],
    queryFn: api.getStatementCoverage,
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

export function useMonthlyFlow(params?: Parameters<typeof api.getMonthlyFlow>[0]) {
  return useQuery({
    queryKey: ['monthly-flow', params],
    queryFn: () => api.getMonthlyFlow(params),
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

export function useBulkCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.bulkCategorize,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}

export function useDeduplicateTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deduplicateTransactions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useDetectTransfers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.detectTransfers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: api.getRules,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; pattern: string; category_id: number; priority?: number }) =>
      api.updateRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

export function useApplyRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.applyRules,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; category_id?: number; category_source?: string; is_transfer?: boolean }) =>
      api.updateTransaction(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
