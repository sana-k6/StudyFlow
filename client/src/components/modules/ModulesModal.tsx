import React, { useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Module } from '@studyflow/shared/types';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';

interface ModulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  onModulesChanged: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

export default function ModulesModal({ isOpen, onClose, modules, onModulesChanged }: ModulesModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState(PRESET_COLORS[0]);
  const [credits, setCredits] = useState<number | ''>(20);
  const [semester, setSemester] = useState('Autumn');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    try {
      setErrorMsg(null);
      await apiClient.createModule({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        color_hex: colorHex,
        credits: credits ? Number(credits) : null,
        semester: semester || null,
      });
      setCode('');
      setName('');
      setIsAdding(false);
      onModulesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create module');
    }
  }

  async function handleDeleteModule(id: string) {
    if (!confirm('Are you sure you want to delete this module? Any linked assignments will be deleted.')) return;
    try {
      await apiClient.deleteModule(id);
      onModulesChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete module');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Academic Modules</h3>
              <p className="text-xs text-slate-500">Manage your university courses and subject tags</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          {/* Module List */}
          <div className="space-y-2">
            {modules.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500">
                No modules configured yet. Add your courses or import a timetable!
              </p>
            ) : (
              modules.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: mod.color_hex }}
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-800">{mod.code}</span>
                        {mod.credits && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-200/60 text-slate-600 rounded">
                            {mod.credits} cr
                          </span>
                        )}
                        {mod.semester && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {mod.semester}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{mod.name}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteModule(mod.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete module"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Module Form */}
          {isAdding ? (
            <form onSubmit={handleAddModule} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Add New Module</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Module Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS201"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Credits</label>
                  <input
                    type="number"
                    placeholder="20"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Semester</label>
                  <input
                    type="text"
                    placeholder="Autumn"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Module Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures and Algorithms"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Color Tag</label>
                <div className="flex items-center space-x-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${colorHex === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : 'opacity-80 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                >
                  Save Module
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-blue-600 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Module</span>
            </button>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
