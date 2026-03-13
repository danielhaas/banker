import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadStatement, confirmImport } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import type { UploadResponse } from '../types';

interface FileResult {
  filename: string;
  status: 'uploading' | 'previewing' | 'confirming' | 'confirmed' | 'duplicate' | 'error';
  data?: UploadResponse;
  error?: string;
  blobUrl?: string;
}

export default function ImportPage() {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const qc = useQueryClient();

  const updateFile = (index: number, update: Partial<FileResult>) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...update } : f)));
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfFiles.length) return;

    setViewingIndex(null);

    const initial: FileResult[] = pdfFiles.map((f) => ({
      filename: f.name,
      status: 'uploading',
      blobUrl: URL.createObjectURL(f),
    }));
    setFiles(initial);

    await Promise.all(
      pdfFiles.map(async (file, index) => {
        try {
          const data = await uploadStatement(file);
          if (data.duplicate) {
            updateFile(index, { status: 'duplicate' });
          } else {
            updateFile(index, { status: 'previewing', data });
          }
        } catch (err: any) {
          updateFile(index, { status: 'error', error: err.message });
        }
      })
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    noClick: true,
    noKeyboard: true,
  });

  const folderInputRef = useRef<HTMLInputElement>(null);
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const arr = Array.from(fileList);
    onDrop(arr);
    e.target.value = '';
  };

  const previewFiles = files.filter((f) => f.status === 'previewing' && f.data);
  const totalTxns = previewFiles.reduce((sum, f) => sum + (f.data?.transactions.length ?? 0), 0);

  const handleConfirmAll = async () => {
    setConfirming(true);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'previewing' || !f.data) continue;
      updateFile(i, { status: 'confirming' });
      try {
        await confirmImport(f.data.import_id);
        updateFile(i, { status: 'confirmed' });
      } catch (err: any) {
        updateFile(i, { status: 'error', error: err.message });
      }
    }
    setConfirming(false);
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    qc.invalidateQueries({ queryKey: ['spending'] });
    qc.invalidateQueries({ queryKey: ['statements'] });
  };

  const confirmedCount = files.filter((f) => f.status === 'confirmed').length;
  const hasResults = files.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Import Statements</h1>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          // @ts-expect-error -- webkitdirectory is valid but not in TS types
          webkitdirectory=""
          multiple
          onChange={handleFolderSelect}
        />
        {files.some((f) => f.status === 'uploading') ? (
          <p className="text-gray-500">Parsing {files.filter((f) => f.status === 'uploading').length} file(s)...</p>
        ) : (
          <>
            <p className="text-gray-600 text-lg">
              {isDragActive ? 'Drop files or folders here' : 'Drag & drop PDFs here'}
            </p>
            <p className="text-gray-400 text-sm mt-3">or</p>
            <div className="flex justify-center gap-3 mt-3">
              <button
                type="button"
                onClick={openFilePicker}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Select Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Select Folder
              </button>
            </div>
          </>
        )}
      </div>

      {/* File status list */}
      {hasResults && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {files.length} file(s) &middot;{' '}
              {previewFiles.length > 0 && `${totalTxns} transactions ready`}
              {confirmedCount > 0 && `${confirmedCount} imported`}
            </p>
            {previewFiles.length > 0 && (
              <button
                onClick={handleConfirmAll}
                disabled={confirming}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {confirming ? 'Importing...' : `Confirm All (${previewFiles.length} files)`}
              </button>
            )}
          </div>

          {/* Per-file status */}
          <div className="bg-white rounded-lg border divide-y">
            {files.map((f, i) => (
              <div key={i}>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{f.filename}</p>
                      {f.data && (
                        <p className="text-xs text-gray-500">
                          {f.data.bank_code}
                          {f.data.template && ` \u00b7 ${f.data.template.replace('_', ' ')}`}
                          {` \u00b7 ${f.data.transactions.length} transactions`}
                        </p>
                      )}
                      {f.error && <p className="text-xs text-red-600">{f.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.blobUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingIndex(viewingIndex === i ? null : i)}
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          viewingIndex === i
                            ? 'bg-blue-600 text-white'
                            : 'text-blue-600 hover:text-blue-800 hover:underline'
                        }`}
                      >
                        {viewingIndex === i ? 'Hide PDF' : 'View PDF'}
                      </button>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        f.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : f.status === 'duplicate'
                            ? 'bg-yellow-100 text-yellow-700'
                            : f.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : f.status === 'uploading' || f.status === 'confirming'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {f.status === 'previewing' ? 'ready' : f.status}
                    </span>
                  </div>
                </div>
                {viewingIndex === i && f.blobUrl && (
                  <div className="border-t bg-gray-50">
                    <iframe
                      src={f.blobUrl}
                      className="w-full"
                      style={{ height: '60vh' }}
                      title={f.filename}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Transaction preview for all ready files */}
          {previewFiles.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewFiles.flatMap((f) =>
                    f.data!.transactions.map((txn, j) => (
                      <tr key={`${f.filename}-${j}`} className="hover:bg-gray-50">
                        {j === 0 ? (
                          <td className="px-4 py-3 text-xs text-gray-500" rowSpan={f.data!.transactions.length}>
                            {f.filename}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 whitespace-nowrap">{txn.date}</td>
                        <td className="px-4 py-3">{txn.description}</td>
                        <td
                          className={`px-4 py-3 text-right whitespace-nowrap font-medium ${
                            txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {txn.amount >= 0 ? '+' : ''}
                          {Number(txn.amount).toLocaleString('en-HK', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-gray-500">
                          {txn.balance_after != null
                            ? Number(txn.balance_after).toLocaleString('en-HK', { minimumFractionDigits: 2 })
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
