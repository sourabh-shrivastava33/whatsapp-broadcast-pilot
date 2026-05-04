import React, { useState } from 'react';
import Papa from 'papaparse';
import { Modal } from './Modal';
import { Button } from './Button';
import Upload from 'lucide-react/dist/esm/icons/upload';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import config from '../../config';

export function ContactImportModal({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      Papa.parse(selected, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setPreview(results.data.slice(0, 5));
        },
      });
    }
  };

  const downloadSample = () => {
    const csvContent = "name,phone,tags,notes,leadStage,intentScore\nJohn Doe,9876543210,\"VIP, Europe\",Interested in 3BHK,HOT,85\nJane Smith,9122334455,Lead,,WARM,50";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_leads_template.csv';
    a.click();
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch(`${config.API_URL}/contacts/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: results.data }),
          });

          const data = await res.json();
          if (data.success) {
            onImported();
            onClose();
          } else {
            setError(data.error || 'Import failed');
          }
        } catch (err) {
          setError('Connection error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Contacts"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleImport} disabled={!file || loading}>
            {loading ? 'Importing...' : 'Start Import'}
          </Button>
        </>
      }
    >
      <div className="import-container">
        <div className="import-hint">
          <p>Upload a CSV file with your contact list. You can include sales intelligence fields for better AI targeting.</p>
          <Button variant="ghost" size="sm" icon={FileText} onClick={downloadSample}>
            Download Template
          </Button>
        </div>

        <label className="file-dropzone">
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <Upload size={32} />
          <span>{file ? file.name : 'Click or drag CSV file here'}</span>
        </label>

        {error && (
          <div className="import-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {preview.length > 0 && (
          <div className="import-preview">
            <label>Preview (First 5 rows)</label>
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => <td key={j}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .import-container { display: flex; flex-direction: column; gap: 16px; }
        .import-hint { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px; font-size: 12px; color: var(--text-secondary); }
        .import-hint p { margin: 0; max-width: 70%; line-height: 1.4; }
        .file-dropzone { border: 2px dashed var(--border-color); border-radius: 12px; padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; }
        .file-dropzone:hover { border-color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }
        .file-dropzone input { display: none; }
        .file-dropzone span { font-size: 14px; font-weight: 500; }
        .import-error { display: flex; align-items: center; gap: 8px; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 6px; font-size: 13px; }
        .import-preview { display: flex; flex-direction: column; gap: 8px; }
        .import-preview label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; }
        .preview-table-wrapper { overflow-x: auto; border: 1px solid var(--border-color); border-radius: 8px; }
        .preview-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .preview-table th { background: rgba(255,255,255,0.05); text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); }
        .preview-table td { padding: 8px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
      `}</style>
    </Modal>
  );
}
