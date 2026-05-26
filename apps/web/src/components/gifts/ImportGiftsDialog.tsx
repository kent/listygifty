"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { captureWebEvent } from "@/lib/analytics";
import { importsService } from "@/services";
import type { ImportGiftsResult } from "@niftygifty/types";

interface ImportGiftsDialogProps {
  holidayId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportGiftsResult) => void;
}

export function ImportGiftsDialog({
  holidayId,
  open,
  onOpenChange,
  onImported,
}: ImportGiftsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportGiftsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
      "name,description,cost,status,link,recipient_name,recipient_email,giver_name,giver_email",
      "Team Hoodie,Blue hoodie,49.99,Idea,https://example.com,Jamie Lee,jamie@example.com,,",
      "Welcome Kit,Notebook and mug,35,Planned,,Alex Chen,alex@example.com,,",
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gift_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);
    captureWebEvent("gift_csv_import_started", {
      holiday_id: holidayId,
    });

    try {
      const importResult = await importsService.importGifts(file, holidayId);
      setResult(importResult);
      onImported(importResult);
      captureWebEvent("gift_csv_import_completed", {
        created: importResult.created,
        errors: importResult.errors.length,
        holiday_id: holidayId,
        people_created: importResult.people_created,
      });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
      captureWebEvent("gift_csv_import_failed", {
        holiday_id: holidayId,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Import Gifts</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Upload a CSV file to create gifts and match recipients by name or email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!result ? (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Need a template?</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadTemplate}
                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">
                  CSV File <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    file
                      ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-violet-600 dark:text-violet-400">
                      <FileSpreadsheet className="h-5 w-5" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Click to select a CSV file</p>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isImporting}
                  className="flex-1 border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || isImporting}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>Created: {result.created} gifts</p>
                  {result.people_created > 0 && (
                    <p>Created: {result.people_created} people</p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Warnings</span>
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((resultError, index) => (
                      <li key={index}>{resultError}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
