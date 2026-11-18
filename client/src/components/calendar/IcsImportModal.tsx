import React, { useState } from 'react';
import { apiClient, ApiErrorResponse } from '../../services/apiClient';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';

interface IcsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_TIMETABLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//University of Birmingham//Timetable//EN
BEGIN:VEVENT
UID:uob-cs201-lec-01@bham.ac.uk
DTSTART:20261119T090000Z
DTEND:20261119T103000Z
SUMMARY:CS201 Data Structures & Algorithms Lecture
LOCATION:Haworth 101
DESCRIPTION:Module: CS201. Topic: Balanced Search Trees
END:VEVENT
BEGIN:VEVENT
UID:uob-cs201-tut-01@bham.ac.uk
DTSTART:20261120T110000Z
DTEND:20261120T123000Z
SUMMARY:CS201 Algorithms Problem Class
LOCATION:Computer Science Lab 2
DESCRIPTION:Bring tutorial sheet 3
END:VEVENT
BEGIN:VEVENT
UID:uob-math102-lec-01@bham.ac.uk
DTSTART:20261121T130000Z
DTEND:20261121T143000Z
SUMMARY:MATH102 Linear Algebra Lecture
LOCATION:Watson LT A
DESCRIPTION:Vector spaces and inner product
END:VEVENT
BEGIN:VEVENT
UID:uob-cs201-exam-01@bham.ac.uk
DTSTART:20261127T140000Z
DTEND:20261127T160000Z
SUMMARY:CS201 Midterm Examination
LOCATION:Great Hall
DESCRIPTION:Closed book examination
END:VEVENT
END:VCALENDAR`;

export default function IcsImportModal({ isOpen, onClose, onSuccess }: IcsImportModalProps) {
  const [icsText, setIcsText] = useState('');
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleImport() {
    if (!icsText.trim()) {
      setErrorMsg('Please paste or load iCalendar (.ics) content');
      return;
    }

    try {
      setImporting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await apiClient.importIcs(icsText);
      setSuccessMsg(res.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof ApiErrorResponse) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to import timetable. Please ensure valid .ics format.');
      }
    } finally {
      setImporting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setIcsText(content);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Import University Timetable</h3>
              <p className="text-xs text-slate-500">Upload or paste an iCalendar (.ics) file</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Upload Button & Sample Prompt */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex-1 cursor-pointer flex items-center justify-center space-x-2 px-3 py-2 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 rounded-lg text-xs font-medium transition">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Choose .ics file</span>
              <input type="file" accept=".ics,text/calendar" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={() => {
                setIcsText(SAMPLE_TIMETABLE);
                setErrorMsg(null);
              }}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Sample Timetable</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              iCalendar Data (.ics format)
            </label>
            <textarea
              rows={8}
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:CS201 Lecture..."
              className="w-full font-mono text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
            💡 <strong>Smart Import:</strong> Automatically classifies lectures, tutorials, and exams, extracts course codes (e.g. CS201), and registers new modules without duplicating existing events.
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importing || !icsText.trim()}
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
          >
            {importing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Import Timetable</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
