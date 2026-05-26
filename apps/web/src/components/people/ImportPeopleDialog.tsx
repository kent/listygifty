"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { captureWebEvent } from "@/lib/analytics";
import { downloadCsvFile } from "@/lib/csv-download";
import { importsService } from "@/services";
import type { ImportPeopleResult, WorkspaceMember } from "@niftygifty/types";

interface ImportPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  workspaceMembers?: WorkspaceMember[];
}

export function ImportPeopleDialog({
  open,
  onOpenChange,
  onSuccess,
  workspaceMembers = [],
}: ImportPeopleDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportPeopleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setOwnerId("");
    setResult(null);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);
    captureWebEvent("people_csv_import_started", {
      owner_assigned: Boolean(ownerId),
    });

    try {
      const importResult = await importsService.importPeople(
        file,
        ownerId ? parseInt(ownerId, 10) : undefined
      );
      setResult(importResult);
      captureWebEvent("people_csv_import_completed", {
        addresses_created: importResult.addresses_created,
        addresses_skipped: importResult.addresses_skipped,
        created: importResult.created,
        errors: importResult.errors.length,
        owner_assigned: Boolean(ownerId),
        skipped: importResult.skipped,
      });

      if (importResult.created > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      captureWebEvent("people_csv_import_failed", {
        owner_assigned: Boolean(ownerId),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadCsvFile("people_import_template.csv", [
      "name,email,relationship,age,gender,birthday,notes,address_label,street_line_1,street_line_2,city,state,postal_code,country,is_default",
      "Jamie Lee,jamie@example.com,coworker,,female,1991-03-14,Remote holiday box recipient,Jamie home,123 Main Street,,Toronto,ON,M5V 2T6,CA,true",
      "Alex Chen,alex@example.com,coworker,,male,,,,,,,,",
    ]);
    captureWebEvent("people_csv_template_downloaded", {
      owner_assigned: Boolean(ownerId),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            Import People
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Upload a CSV file to import people and optional business shipping addresses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!result ? (
            <>
              {/* Template Download */}
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

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">
                  CSV File <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                    transition-colors
                    ${file
                      ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }
                  `}
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

              {/* Owner Selection */}
              {workspaceMembers.length > 1 && (
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Assign Owner (optional)
                  </Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                      <SelectValue placeholder="Current user (default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Current user (default)</SelectItem>
                      {workspaceMembers.map((member) => (
                        <SelectItem key={member.user_id} value={String(member.user_id)}>
                          {member.first_name} {member.last_name} ({member.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose who will own the imported people
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
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
            /* Results View */
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>Created: {result.created} people</p>
                  {result.addresses_created > 0 && (
                    <p>Created: {result.addresses_created} addresses</p>
                  )}
                  {result.skipped > 0 && (
                    <p>Skipped: {result.skipped} (duplicate emails)</p>
                  )}
                  {result.addresses_skipped > 0 && (
                    <p>Skipped: {result.addresses_skipped} duplicate addresses</p>
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
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
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
