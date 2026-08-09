'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import {
  Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, FileText,
  BookOpen, Download, Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { VERTICALS } from '@/lib/verticals';
import { executeImport, type ImportRow, type ImportResult } from '../actions';
import { bulkEnrichAccounts } from '@/app/(app)/accounts/enrich';

type Step = 'upload' | 'map' | 'preview' | 'done';

const TARGET_FIELDS = [
  { key: 'organization', label: 'Business / Account' },
  { key: 'vertical', label: 'Vertical' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'notes', label: 'Notes' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Lifecycle status' },
  { key: 'legacy_id', label: 'Legacy / Place ID' },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]['key'];

const AUTO_MATCH: Record<string, TargetKey> = {
  'organization': 'organization', 'company': 'organization', 'account': 'organization',
  'business': 'organization', 'business name': 'organization', 'shop': 'organization',
  'store': 'organization', 'name': 'organization',
  'vertical': 'vertical', 'category': 'vertical', 'type': 'vertical', 'industry': 'vertical',
  'city': 'city', 'town': 'city',
  'state': 'state', 'st': 'state',
  'phone': 'phone', 'phone number': 'phone', 'tel': 'phone', 'telephone': 'phone',
  'cell': 'phone', 'mobile': 'phone',
  'website': 'website', 'url': 'website', 'site': 'website', 'web': 'website', 'domain': 'website',
  'notes': 'notes', 'note': 'notes', 'comments': 'notes', 'comment': 'notes',
  'first name': 'first_name', 'firstname': 'first_name', 'first': 'first_name',
  'owner': 'first_name', 'owner name': 'first_name', 'contact': 'first_name',
  'last name': 'last_name', 'lastname': 'last_name', 'last': 'last_name',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'title': 'title', 'job title': 'title', 'role': 'title',
  'status': 'status', 'lifecycle': 'status', 'stage': 'status',
  'id': 'legacy_id', 'place id': 'legacy_id', 'place_id': 'legacy_id', 'legacy id': 'legacy_id',
};

// ---- Column reference data (rendered on the upload step) ----
const COLUMN_DOCS: { col: string; aliases: string; req: string; notes: string }[] = [
  { col: 'Business', aliases: 'company, account, shop, store, name', req: 'This or First name', notes: 'The account. Rows sharing a business collapse into one account.' },
  { col: 'City', aliases: 'town', req: 'Strongly recommended', notes: 'Drives the Google match for map pin, band, and crypto score.' },
  { col: 'Vertical', aliases: 'category, type, industry', req: 'Optional', notes: 'Unrecognized values fall back to the default vertical.' },
  { col: 'Phone', aliases: 'phone number, tel, cell, mobile', req: 'Optional', notes: 'Powers Call Mode. Lands on the contact.' },
  { col: 'Website', aliases: 'url, site, domain', req: 'Optional', notes: '' },
  { col: 'First name', aliases: 'firstname, owner, contact', req: 'This or Business', notes: 'Person rows. Business-only rows are fine - a placeholder contact is created when there is a phone or email to keep.' },
  { col: 'Last name', aliases: 'lastname', req: 'Optional', notes: '' },
  { col: 'Email', aliases: 'email address', req: 'Optional', notes: 'Duplicate emails already in the CRM are skipped, not doubled.' },
  { col: 'Title', aliases: 'job title, role', req: 'Optional', notes: '' },
  { col: 'State', aliases: 'st', req: 'Optional', notes: 'Defaults to AZ.' },
  { col: 'Notes', aliases: 'comments', req: 'Optional', notes: 'Lands on the account.' },
  { col: 'Status', aliases: 'lifecycle, stage', req: 'Optional', notes: 'new / working / engaged / customer / disqualified.' },
];

function downloadTemplate() {
  const csv = [
    'Business,City,Vertical,Phone,Website,First name,Last name,Email,Title,Notes',
    'Ballpark Pizza and Subs,Glendale,food-drink,(623) 555-0142,https://ballparkpizzaaz.com,Aaron,Franklin,aaron@ballparkpizzaaz.com,Owner,Met at the register',
    "Desert Bloom Nails,Mesa,nail-beauty,(480) 555-0117,,,,,,Business-only row - no contact person needed",
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nectarpay-import-template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

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
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Excel files not supported. Save your file as CSV first (File → Save As → CSV).');
      return;
    }
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!data.length) { toast.error('File appears to be empty'); return; }
        const fields = (meta.fields || []).filter(Boolean);
        if (!fields.length) {
          toast.error('No column headers found. First row of CSV must be column names.');
          return;
        }
        if (data.length > 2000) {
          toast.error('Over 2,000 rows - split the file. (Big lead sweeps belong in the scraper import, not here.)');
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
        <StepDot active={step === 'done'} done={step === 'done'} label="04" title="Import + Sync" />
      </div>

      {step === 'upload' && (
        <>
          <UploadStep onFile={handleFile} />
          <ColumnReference />
        </>
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
        <DoneStep result={result} onContinue={() => router.push('/accounts')} />
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
        or click below to browse · CSV files only · up to 2,000 rows
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
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

function ColumnReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border border-border/40 rounded-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
      >
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Column reference — what headers we understand
        </span>
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Headers are auto-detected (case-insensitive). Anything else can be mapped by hand in step 2.</span>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 px-2.5 py-1.5 font-bold text-foreground hover:border-primary/50"
            >
              <Download className="h-3.5 w-3.5" /> Download template CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border border-border/40">
            <table className="w-full text-xs">
              <thead className="bg-background/50 border-b border-border/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Column</th>
                  <th className="text-left px-3 py-2 font-medium">Also detected as</th>
                  <th className="text-left px-3 py-2 font-medium">Required?</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_DOCS.map(d => (
                  <tr key={d.col} className="border-b border-border/20 last:border-0 align-top">
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">{d.col}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.aliases}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.req}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <b className="text-foreground">Verticals this instance knows:</b>{' '}
            {VERTICALS.map(v => v.value).join(' · ')}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Map pins, Hot/Warm/Cool bands, and crypto scores don't come from the CSV — the <b className="text-foreground">Sync step after import</b> matches each new account on Google and computes them, same as scraped leads.
          </div>
        </div>
      )}
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
  const mapped = Object.values(mapping);
  const ok = mapped.includes('organization') || mapped.includes('first_name');
  return (
    <div>
      <div className="mb-5 text-sm text-muted-foreground">
        <strong className="text-foreground">{rowCount} rows</strong> detected.
        Map your CSV columns to NectarPay fields. We auto-matched what we recognized.
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
      {!ok && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Map a column to <strong>Business / Account</strong> or <strong>First name</strong> to proceed.</span>
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Button onClick={onNext} disabled={!ok} className="font-display tracking-wider btn-glow">
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
  const contactCount = rows.filter(r => r.first_name || r.email || r.phone).length;
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <PreviewKpi label="Total rows" value={rows.length.toString()} />
        <PreviewKpi label="Unique accounts" value={accountCount.toString()} accent />
        <PreviewKpi label="Contacts to create" value={contactCount.toString()} />
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
        First 5 rows
      </div>
      <div className="border border-border/40 rounded-md overflow-x-auto mb-5">
        <table className="w-full text-xs">
          <thead className="bg-background/50 border-b border-border/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Business</th>
              <th className="text-left px-3 py-2 font-medium">City</th>
              <th className="text-left px-3 py-2 font-medium">Contact</th>
              <th className="text-left px-3 py-2 font-medium">Phone</th>
              <th className="text-left px-3 py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((r, i) => (
              <tr key={i} className="border-b border-border/20 last:border-0">
                <td className="px-3 py-2">{r.organization || '—'}</td>
                <td className="px-3 py-2">{r.city || '—'}</td>
                <td className="px-3 py-2">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.phone || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={pending}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Button onClick={onImport} disabled={pending} className="font-display tracking-wider btn-glow">
          {pending ? 'IMPORTING...' : `IMPORT ${rows.length} ROWS`}
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
  const [syncState, setSyncState] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [tally, setTally] = useState({ linked: 0, noMatch: 0, duplicate: 0, skipped: 0 });

  const runSync = async () => {
    setSyncState('running');
    const ids = result.createdAccountIds;
    const sum = { linked: 0, noMatch: 0, duplicate: 0, skipped: 0 };
    const CHUNK = 6;
    for (let i = 0; i < ids.length; i += CHUNK) {
      try {
        const r = await bulkEnrichAccounts(ids.slice(i, i + CHUNK));
        sum.linked += r.linked; sum.noMatch += r.noMatch;
        sum.duplicate += r.duplicate; sum.skipped += r.skipped;
      } catch {
        sum.skipped += Math.min(CHUNK, ids.length - i);
      }
      setProgress(Math.min(ids.length, i + CHUNK));
      setTally({ ...sum });
    }
    setSyncState('done');
  };

  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 text-primary flex items-center justify-center glow-halo">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="font-display text-3xl tracking-wider mb-2">IMPORT COMPLETE</h3>
      <p className="text-muted-foreground mb-5">
        <strong className="text-primary">{result.accountsCreated}</strong> accounts and{' '}
        <strong className="text-primary">{result.successCount}</strong> contacts created
        {result.skippedCount > 0 && <>, <strong>{result.skippedCount}</strong> duplicates skipped</>}
        {result.errorCount > 0 && <>, <strong className="text-destructive">{result.errorCount}</strong> errors</>}.
      </p>

      {result.createdAccountIds.length > 0 && (
        <div className="mx-auto mb-6 max-w-md rounded-md border border-primary/40 bg-primary/5 p-4 text-left">
          <div className="mb-1 inline-flex items-center gap-2 text-sm font-bold">
            <Link2 className="h-4 w-4 text-primary" /> Sync to map, bands &amp; crypto
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Match each new account on Google — map pin, Hot/Warm/Cool band, and crypto density, same treatment as scraped leads. The email engine never touches synced field accounts.
          </p>
          {syncState === 'idle' && (
            <Button onClick={runSync} size="sm" className="font-display tracking-wider btn-glow">
              🔗 SYNC {result.createdAccountIds.length} ACCOUNTS
            </Button>
          )}
          {syncState !== 'idle' && (
            <div className="text-xs">
              <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round((progress / result.createdAccountIds.length) * 100)}%` }}
                />
              </div>
              <div className="text-muted-foreground">
                {syncState === 'running'
                  ? `Syncing… ${progress} / ${result.createdAccountIds.length}`
                  : `Done — ${tally.linked} linked · ${tally.noMatch} no match · ${tally.duplicate} already in CRM${tally.skipped ? ` · ${tally.skipped} skipped` : ''}`}
              </div>
            </div>
          )}
        </div>
      )}

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
      <Button onClick={onContinue} disabled={syncState === 'running'} className="font-display tracking-wider btn-glow">
        VIEW ACCOUNTS <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}
