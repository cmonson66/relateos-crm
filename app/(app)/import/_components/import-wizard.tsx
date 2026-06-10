'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { executeImport, type ImportRow, type ImportResult } from '../actions';

type Step = 'upload' | 'map' | 'preview' | 'done';

const TARGET_FIELDS = [
  { key: 'organization', label: 'Organization (Account)' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'first_name', label: 'First name *' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Lifecycle status' },
  { key: 'sport_focus', label: 'Sport / Focus → tag' },
  { key: 'school_tier', label: 'School Tier → tag' },
  { key: 'legacy_id', label: 'Legacy ID' },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]['key'];

const AUTO_MATCH: Record<string, TargetKey> = {
  'organization': 'organization',
  'company': 'organization',
  'account': 'organization',
  'vertical': 'vertical',
  'first name': 'first_name',
  'firstname': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'email': 'email',
  'email address': 'email',
  'title': 'title',
  'job title': 'title',
  'role': 'title',
  'status': 'status',
  'lifecycle': 'status',
  'sport': 'sport_focus',
  'focus': 'sport_focus',
  'sport / focus': 'sport_focus',
  'sport/focus': 'sport_focus',
  'school tier': 'school_tier',
  'tier': 'school_tier',
  'id': 'legacy_id',
};

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetKey | 'skip'>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File) {
    if (!file) return;

    // Reject xlsx with a friendly message
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Excel files not supported. Save your file as CSV first (File → Save As → CSV).');
      return;
    }

    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!data.length) {
          toast.error('File appears to be empty');
          return;
        }
        const fields = (meta.fields || []).filter(Boolean);
        if (!fields.length) {
          toast.error('No column headers found. First row of CSV must be column names.');
          return;
        }
        setRawRows(data);
        setHeaders(fields);

        const initial: Record<string, TargetKey | 'skip'> = {};
        fields.forEach(h => {
          const norm = h.toLowerCase().trim();
          initial[h] = AUTO_MATCH[norm] || 'skip';
        });
        setMapping(initial);
        setStep('map');
        toast.success(`${data.length} rows loaded`);
      },
      error: (err) => toast.error('Failed to parse: ' + err.message),
    });
  }

  function buildImportRows(): ImportRow[] {
    return rawRows.map(row => {
      const out: ImportRow = {};
      for (const [header, target] of Object.entries(mapping)) {
        if (target === 'skip') continue;
        const val = row[header];
        if (val !== undefined && val !== null && String(val).trim()) {
          (out as Record<string, string>)[target] = String(val).trim();
        }
      }
      return out;
    });
  }

  function handleImport() {
    const rows = buildImportRows();
    startTransition(async () => {
      try {
        const res = await executeImport(rows, filename);
        setResult(res);
        setStep('done');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed');
      }
    });
  }

  return (
    <div className="card-lit border border-border/40 rounded-md p-7 relative">
      <div className="h-[3px] bg-primary glow-stripe rounded-t-md absolute inset-x-0 top-0" />

      <div className="flex items-center gap-3 mb-7">
        <StepDot active={step === 'upload'} done={step !== 'upload'} label="01" title="Upload" />
        <StepLine done={step !== 'upload'} />
        <StepDot active={step === 'map'} done={step === 'preview' || step === 'done'} label="02" title="Map fields" />
        <StepLine done={step === 'preview' || step === 'done'} />
        <StepDot active={step === 'preview'} done={step === 'done'} label="03" title="Preview" />
        <StepLine done={step === 'done'} />
        <StepDot active={step === 'done'} done={step === 'done'} label="04" title="Done" />
      </div>

      {step === 'upload' && (
        <UploadStep onFile={handleFile} />
      )}

      {step === 'map' && (
        <MapStep
          headers={headers}
          mapping={mapping}
          setMapping={setMapping}
          rowCount={rawRows.length}
          onBack={() => setStep('upload')}
          onNext={() => setStep('preview')}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          rows={buildImportRows()}
          onBack={() => setStep('map')}
          onImport={handleImport}
          pending={pending}
        />
      )}

      {step === 'done' && result && (
        <DoneStep result={result} onContinue={() => router.push('/contacts')} />
      )}
    </div>
  );
}

function StepDot({ active, done, label, title }: { active: boolean; done: boolean; label: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-md font-display flex items-center justify-center border transition-all ${
        done ? 'bg-primary text-primary-foreground border-primary' :
        active ? 'bg-primary/20 text-primary border-primary glow-stripe-soft' :
        'bg-muted/30 text-muted-foreground border-border/40'
      }`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : label}
      </div>
      <div className={`text-xs uppercase tracking-[0.15em] ${
        done || active ? 'text-foreground' : 'text-muted-foreground'
      }`}>
        {title}
      </div>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return <div className={`flex-1 h-px ${done ? 'bg-primary' : 'bg-border/40'}`} />;
}

function UploadStep({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`border-2 border-dashed rounded-md p-12 text-center transition-colors ${
        drag ? 'border-primary bg-primary/5' : 'border-border/40'
      }`}
    >
      <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-display text-2xl tracking-wider mb-2">DROP YOUR CSV</h3>
      <p className="text-sm text-muted-foreground mb-5">
        or click below to browse · CSV files only · max 10,000 rows
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Reset so picking the same file again retriggers
          if (e.target) e.target.value = '';
        }}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="font-display tracking-wider btn-glow"
      >
        BROWSE FILES
      </Button>
    </div>
  );
}

function MapStep({
  headers, mapping, setMapping, rowCount, onBack, onNext,
}: {
  headers: string[];
  mapping: Record<string, TargetKey | 'skip'>;
  setMapping: (m: Record<string, TargetKey | 'skip'>) => void;
  rowCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasFirstName = Object.values(mapping).includes('first_name');
  return (
    <div>
      <div className="mb-5 text-sm text-muted-foreground">
        <strong className="text-foreground">{rowCount} rows</strong> detected.
        Map your CSV columns to RelateOS fields. We auto-matched what we recognized.
      </div>
      <div className="space-y-2 mb-6">
        {headers.map(h => (
          <div key={h} className="grid grid-cols-2 items-center gap-3 py-2 border-b border-border/20 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm truncate">{h}</span>
            </div>
            <Select
              value={mapping[h] || 'skip'}
              onValueChange={(v) => setMapping({ ...mapping, [h]: v as TargetKey | 'skip' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">— Skip this column —</SelectItem>
                {TARGET_FIELDS.map(f => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {!hasFirstName && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>You must map a column to <strong>First name</strong> to proceed.</span>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Button onClick={onNext} disabled={!hasFirstName} className="font-display tracking-wider btn-glow">
          PREVIEW <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({
  rows, onBack, onImport, pending,
}: {
  rows: ImportRow[];
  onBack: () => void;
  onImport: () => void;
  pending: boolean;
}) {
  const sample = rows.slice(0, 5);
  const accountCount = new Set(rows.map(r => r.organization?.trim()).filter(Boolean)).size;
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <PreviewKpi label="Total rows" value={rows.length.toString()} />
        <PreviewKpi label="Unique accounts" value={accountCount.toString()} />
        <PreviewKpi label="Will create" value={`${rows.length} contacts`} accent />
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
        First 5 rows
      </div>
      <div className="border border-border/40 rounded-md overflow-x-auto mb-5">
        <table className="w-full text-xs">
          <thead className="bg-background/50 border-b border-border/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium">First name</th>
              <th className="text-left px-3 py-2 font-medium">Last name</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
              <th className="text-left px-3 py-2 font-medium">Account</th>
              <th className="text-left px-3 py-2 font-medium">Stage</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((r, i) => (
              <tr key={i} className="border-b border-border/20 last:border-0">
                <td className="px-3 py-2">{r.first_name || '—'}</td>
                <td className="px-3 py-2">{r.last_name || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.email || '—'}</td>
                <td className="px-3 py-2">{r.organization || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.status || 'new'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={pending}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Button onClick={onImport} disabled={pending} className="font-display tracking-wider btn-glow">
          {pending ? 'IMPORTING...' : `IMPORT ${rows.length} CONTACTS`}
        </Button>
      </div>
    </div>
  );
}

function PreviewKpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-4 ${accent ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-background/30'}`}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">{label}</div>
      <div className={`font-display text-2xl tracking-wider ${accent ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function DoneStep({ result, onContinue }: { result: ImportResult; onContinue: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 text-primary flex items-center justify-center glow-halo">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="font-display text-3xl tracking-wider mb-2">IMPORT COMPLETE</h3>
      <p className="text-muted-foreground mb-6">
        <strong className="text-primary">{result.successCount}</strong> contacts created
        {result.errorCount > 0 && (
          <>, <strong className="text-destructive">{result.errorCount}</strong> errors</>
        )}.
      </p>
      {result.errors.length > 0 && (
        <div className="text-left bg-destructive/5 border border-destructive/30 rounded-md p-4 mb-6 max-h-48 overflow-auto">
          <div className="text-xs uppercase tracking-[0.15em] text-destructive mb-2">Errors</div>
          {result.errors.slice(0, 20).map((e, i) => (
            <div key={i} className="text-xs text-muted-foreground py-1">
              <span className="text-destructive font-medium">Row {e.row}:</span> {e.message}
            </div>
          ))}
          {result.errors.length > 20 && (
            <div className="text-xs text-muted-foreground italic mt-2">
              + {result.errors.length - 20} more errors logged in import history
            </div>
          )}
        </div>
      )}
      <Button onClick={onContinue} className="font-display tracking-wider btn-glow">
        VIEW CONTACTS <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
