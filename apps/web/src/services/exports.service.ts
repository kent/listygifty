import { apiClient } from "@/lib/api-client";

class ExportsService {
  downloadGiftsCsv(holidayId: number): Promise<void> {
    return this.downloadCsv(`/exports/gifts?holiday_id=${holidayId}`, `gifts_${holidayId}.csv`);
  }

  downloadPeopleCsv(): Promise<void> {
    return this.downloadCsv("/exports/people", "people.csv");
  }

  private async downloadCsv(endpoint: string, fallbackFilename: string): Promise<void> {
    const { blob, headers } = await apiClient.getBlob(endpoint, { headers: { Accept: "text/csv" } });
    const filename = headers.get("Content-Disposition")?.match(/filename="?([^";\n]+)"?/)?.[1] || fallbackFilename;
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    try {
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    }
  }
}

export const exportsService = new ExportsService();
