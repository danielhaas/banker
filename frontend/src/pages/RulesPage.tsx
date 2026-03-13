import { useState } from 'react';
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useApplyRules, useCategories } from '../hooks/useApi';

export default function RulesPage() {
  const { data: rules, isLoading } = useRules();
  const { data: categories } = useCategories();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const applyRules = useApplyRules();

  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [patternError, setPatternError] = useState('');

  const parentCategories = categories?.filter((c) => c.parent_id === null) ?? [];

  const validatePattern = (p: string) => {
    try {
      new RegExp(p, 'i');
      setPatternError('');
      return true;
    } catch {
      setPatternError('Invalid regex pattern');
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern || !categoryId) return;
    if (!validatePattern(pattern)) return;

    const data = { pattern, category_id: Number(categoryId), priority };

    if (editingId) {
      updateRule.mutate({ id: editingId, ...data }, {
        onSuccess: () => resetForm(),
      });
    } else {
      createRule.mutate(data, {
        onSuccess: () => resetForm(),
      });
    }
  };

  const resetForm = () => {
    setPattern('');
    setCategoryId('');
    setPriority(0);
    setEditingId(null);
    setPatternError('');
  };

  const startEdit = (rule: { id: number; pattern: string; category_id: number; priority: number }) => {
    setEditingId(rule.id);
    setPattern(rule.pattern);
    setCategoryId(String(rule.category_id));
    setPriority(rule.priority);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Category Rules</h1>
        <button
          onClick={() => applyRules.mutate(undefined, {
            onSuccess: (data) => alert(`Categorized ${data.categorized} transaction(s)`),
          })}
          disabled={applyRules.isPending}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {applyRules.isPending ? 'Applying...' : 'Apply Rules'}
        </button>
      </div>

      {/* Add/Edit form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {editingId ? 'Edit Rule' : 'Add Rule'}
        </h2>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Regex pattern (e.g. SPOTIFY|NETFLIX)"
              value={pattern}
              onChange={(e) => { setPattern(e.target.value); if (e.target.value) validatePattern(e.target.value); }}
              className={`border rounded-lg px-3 py-2 text-sm w-full ${patternError ? 'border-red-400' : ''}`}
            />
            {patternError && <p className="text-xs text-red-500 mt-1">{patternError}</p>}
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm min-w-48"
          >
            <option value="">Select category</option>
            {parentCategories.map((cat) => (
              <optgroup key={cat.id} label={`${cat.icon ?? ''} ${cat.name}`}>
                {categories
                  ?.filter((c) => c.parent_id === cat.id)
                  .map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.icon ?? ''} {child.name}
                    </option>
                  ))}
                <option value={cat.id}>{cat.name} (General)</option>
              </optgroup>
            ))}
          </select>
          <input
            type="number"
            placeholder="Priority"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm w-24"
            title="Higher priority rules are checked first"
          />
          <button
            type="submit"
            disabled={!pattern || !categoryId}
            className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-30"
          >
            {editingId ? 'Update' : 'Add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Rules list */}
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !rules?.length ? (
        <p className="text-gray-500 text-center py-12">No rules yet. Add one above.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Pattern</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Priority</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{rule.pattern}</td>
                  <td className="px-4 py-3">{rule.category_name ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-right">{rule.priority}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(rule)}
                      className="text-blue-600 hover:text-blue-800 text-xs mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this rule?')) deleteRule.mutate(rule.id); }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
