import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { supabase } from './lib/supabase';
import './App.css';

const APP_NAME = 'BSWP Level Up';
const APP_PIN = '2222';
const OPNAME_PIN = '8888';
const MASTER_ADMIN_PIN = '14045';

const AREA_OPTIONS = ['PRODUKSI', 'PACKING'];

const LINE_OPTIONS = ['All line', '1', '2', '3', '4', '5', 'Lainnya'];

const KATEGORI_WASTE_OPTIONS = [
  'PRO',
  'TRIAL',
  'ADJUSMENT OR RECYCLE',
  'ADJUSMENT FOR SCRAPPING',
  'LAINNYA',
];const TUJUAN_PRODUKSI_OPTIONS = ['1112', '1113', 'LAINNYA'];
const PEMBELI_KOTOR_OPTIONS = [
  'HERI',
  'HARIMI',
  'BIOMAS PELET',
  'KITE INSENERATOR',
  'LAINNYA',
];

const CHART_COLORS = {
  waste: '#2af5b8',
  proses: '#4aabff',
  bersih: '#8f6fff',
  kirim: '#ff5bd4',
  kotor: '#ff4d6d',
  gold: '#f7c948',
};

const CHART_TOOLTIP_STYLE = {
  background: 'rgba(9, 10, 28, 0.96)',
  border: '1px solid rgba(160, 175, 255, 0.22)',
  borderRadius: 16,
  color: '#f4f6ff',
  boxShadow: '0 18px 50px rgba(0,0,0,0.42)',
};

const WAREHOUSE_CAPACITY = {
  bubukBersihKg: 180000,
  wasteKg: 15000,
};

const DASHBOARD_FLOW_OPTIONS = [
  { value: 'ALL', label: 'Semua Waste' },
  { value: 'GILING', label: 'Waste Recycle / Giling' },
  { value: 'KOTOR', label: 'Waste Kotor' },
];

const REPORT_SHIFT_ORDER = ['SHIFT 1', 'SHIFT 2', 'SHIFT 3'];

const REPORT_SOURCE_BUCKETS = [
  { key: 'PRODUKSI-1112', area: 'PRODUKSI', plant: '1112', label: 'Produksi 1112' },
  { key: 'PRODUKSI-1113', area: 'PRODUKSI', plant: '1113', label: 'Produksi 1113' },
  { key: 'PACKING-1112', area: 'PACKING', plant: '1112', label: 'Packing 1112' },
  { key: 'PACKING-1113', area: 'PACKING', plant: '1113', label: 'Packing 1113' },
];

function normalizeReportShift(value) {
  const text = String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (text.includes('1')) return 'SHIFT 1';
  if (text.includes('2')) return 'SHIFT 2';
  if (text.includes('3')) return 'SHIFT 3';
  return 'SHIFT 3';
}

function getShiftRank(value) {
  const shift = normalizeReportShift(value);
  const index = REPORT_SHIFT_ORDER.indexOf(shift);
  return index === -1 ? 99 : index;
}

function normalizeReportArea(value) {
  const text = String(value || '').toUpperCase().trim();
  if (text.includes('PACK')) return 'PACKING';
  if (text.includes('PROD')) return 'PRODUKSI';
  return text || '-';
}

function normalizeReportPlant(value) {
  const text = String(value || '').toUpperCase().trim();
  if (text.includes('1112')) return '1112';
  if (text.includes('1113')) return '1113';
  return text || '-';
}


function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toKeyText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseNumber(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return NaN;
  return Number(text);
}

function formatNumber(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('id-ID', { maximumFractionDigits: 3 });
}

function formatPercent(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0%';
  return `${num.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

function clampPercent(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function gcdTwo(a, b) {
  let x = Math.abs(Math.round(Number(a || 0)));
  let y = Math.abs(Math.round(Number(b || 0)));

  if (x === 0) return y;
  if (y === 0) return x;

  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x;
}

function gcdMany(values) {
  const nums = values.map((item) => Math.abs(Math.round(Number(item || 0)))).filter((item) => item > 0);
  if (nums.length === 0) return 1;
  return nums.reduce((acc, value) => gcdTwo(acc, value), nums[0]) || 1;
}

function makeRatio(values) {
  const nums = values.map((item) => Math.max(0, Math.round(Number(item || 0))));
  const divider = gcdMany(nums);
  return nums.map((item) => (item === 0 ? 0 : Math.round(item / divider))).join(' : ');
}

function getUtilStatus(percent) {
  const value = Number(percent || 0);
  if (value >= 100) return { label: 'Over capacity', className: 'capacity-danger-dark' };
  if (value >= 90) return { label: 'Kritis', className: 'capacity-danger' };
  if (value >= 75) return { label: 'Warning', className: 'capacity-warning' };
  return { label: 'Aman', className: 'capacity-safe' };
}


function parseYmdDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffDaysYmd(startValue, endValue) {
  const start = parseYmdDate(startValue);
  const end = parseYmdDate(endValue);
  if (!start || !end) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function getTodayDateOnly() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getBatchLifetimeInfo(item) {
  const todayYmdValue = todayYmd();
  const tanggalGiling = item.tanggal || item.tanggal_giling || item.created_at;
  const expiredDate = item.expired_date;
  const ageDays = Math.max(0, diffDaysYmd(tanggalGiling, todayYmdValue));
  const lifetimeDays = Math.max(0, diffDaysYmd(tanggalGiling, expiredDate));
  const remainingDays = expiredDate ? diffDaysYmd(todayYmdValue, expiredDate) : null;

  const awalKg = Number(item.qty_bersih || item.total_bersih || 0);
  const sisaKg = Number(item.sisa_bubuk_bersih || 0);
  const keluarKg = Math.max(0, awalKg - sisaKg);
  const sisaPct = awalKg > 0 ? (sisaKg / awalKg) * 100 : 0;
  const movementPct = awalKg > 0 ? (keluarKg / awalKg) * 100 : 0;

  let movementLabel = 'Fast moving';
  let movementLevel = 'fast';
  let movementClass = 'aging-fast';

  if (ageDays >= 180 && sisaPct >= 50) {
    movementLabel = 'Very slow moving';
    movementLevel = 'verySlow';
    movementClass = 'aging-danger';
  } else if (ageDays >= 90 && sisaPct >= 40) {
    movementLabel = 'Slow moving';
    movementLevel = 'slow';
    movementClass = 'aging-warning';
  } else if (ageDays >= 60 && sisaPct >= 60) {
    movementLabel = 'Watchlist';
    movementLevel = 'watch';
    movementClass = 'aging-watch';
  } else if (ageDays >= 30) {
    movementLabel = 'Normal aging';
    movementLevel = 'normal';
    movementClass = 'aging-normal';
  }

  return {
    tanggalGiling,
    expiredDate,
    ageDays,
    lifetimeDays,
    remainingDays,
    awalKg,
    sisaKg,
    keluarKg,
    sisaPct,
    movementPct,
    movementLabel,
    movementLevel,
    movementClass,
  };
}

function getCapacityForecast(totalKg, capacityKg, avgDailyInKg) {
  if (!capacityKg || capacityKg <= 0) return { label: 'Kapasitas belum di-set', days: null, level: 'none' };
  const remaining = Math.max(0, capacityKg - Number(totalKg || 0));
  if (remaining <= 0) return { label: 'Sudah penuh / over capacity', days: 0, level: 'danger' };
  if (!avgDailyInKg || avgDailyInKg <= 0) return { label: 'Trend masuk belum cukup', days: null, level: 'safe' };

  const days = Math.ceil(remaining / avgDailyInKg);
  if (days <= 7) return { label: `Estimasi penuh ${days} hari lagi`, days, level: 'danger' };
  if (days <= 30) return { label: `Estimasi penuh ${days} hari lagi`, days, level: 'warning' };
  return { label: `Aman ±${days} hari`, days, level: 'safe' };
}

function getYieldValue(item) {
  const proses = Number(item.qty_proses_giling || 0);
  const bersih = Number(item.qty_bersih || 0);
  const fromField = Number(item.yield_realisasi || 0);
  if (fromField > 0) return fromField;
  if (proses <= 0) return 0;
  return (bersih / proses) * 100;
}

function formatDate(date) {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getShiftByDate(date) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  if (totalMinutes >= 9 * 60 && totalMinutes <= 17 * 60) return 'SHIFT 1';
  if (totalMinutes >= 17 * 60 + 1 || totalMinutes <= 1 * 60) return 'SHIFT 2';
  return 'SHIFT 3';
}

function hitungPcsKantong(qtyKg) {
  const kg = Number(qtyKg || 0);

  if (Number.isNaN(kg) || kg <= 1) return 0;

  const fullBag = Math.floor(kg / 20);
  const sisa = kg % 20;

  return fullBag + (sisa > 1 ? 1 : 0);
}

function normalizeLine(masterLine) {
  const value = String(masterLine || '').trim();
  const upper = value.toUpperCase();

  if (!value) return { line: '', lineLainnya: '' };

  if (upper === 'ALL LINE' || upper === 'ALL' || upper === 'SEMUA') {
    return { line: 'All line', lineLainnya: '' };
  }

  if (['1', '2', '3', '4', '5'].includes(value)) {
    return { line: value, lineLainnya: '' };
  }

  return { line: 'Lainnya', lineLainnya: value };
}

function pageTitle(page) {
  const map = {
    home: 'Menu Awal',
    dashboard: 'Dashboard BSWP',
    formMenu: 'Form Penginputan',
    pinForm: 'Akses Form Penginputan',
    opnamePin: 'Akses Stock Opname',
    stockOpname: 'Stock Opname',
    masterAdminPin: 'Akses Master Data Admin',
    masterAdminConfirm: 'Konfirmasi Akses Master Data',
    masterData: 'Master Data Admin',
    wasteMasuk: 'Input Waste Masuk',
    prosesGiling: 'Input Proses Giling',
    hasilGiling: 'Input Hasil Giling',
    pengirimanBersih: 'Pengiriman Bubuk Bersih',
    pengeluaranKotor: 'Pengeluaran Waste Kotor',
  };

  return map[page] || APP_NAME;
}

function HistoryDrawer({
  open,
  onClose,
  title,
  historyDate,
  setHistoryDate,
  loading,
  rows,
  page,
}) {
  if (!open) return null;

  function renderRow(row) {
    if (page === 'wasteMasuk') {
      return (
        <div className="history-card" key={row.id || row.id_waste_masuk}>
          <b>{row.id_waste_masuk}</b>
          <span>{row.nama_waste}</span>
          <small>
            {row.tanggal} • {row.jam_input || '-'} • {row.shift || '-'}
          </small>
          <small>
            {formatNumber(row.qty_masuk)} KG • {row.area_asal || '-'} • Line {row.line || '-'}
          </small>
          <small>{row.keterangan || '-'}</small>
        </div>
      );
    }

    if (page === 'prosesGiling') {
  return (
    <div className="history-card" key={row.id || `${row.id_waste_masuk}-${row.jam_input}`}>
      <b>{row.id_waste_masuk}</b>
      <span>{row.nama_waste || '-'}</span>
      <small>
        {row.tanggal} • {row.jam_input || '-'} • {row.shift || '-'}
      </small>
      <small>
        Group: {row.group_id || '-'} • {row.kategori_waste || '-'} • {row.no_pro_keterangan || '-'}
      </small>
      <small>
        Plant {row.plant_asal || '-'} • {row.area_asal || '-'} • Line {row.line || '-'}
      </small>
      <small>Masuk Giling: {formatNumber(row.qty_masuk_giling)} KG</small>
      <small>{row.keterangan || '-'}</small>
    </div>
  );
}

    if (page === 'hasilGiling') {
  return (
    <div className="history-card" key={row.id || row.no_batch_bubuk}>
      <b>{row.no_batch_bubuk}</b>
      <span>{row.nama_bubuk || '-'}</span>
      <small>
        {row.tanggal} • {row.jam_input || '-'} • {row.shift || '-'}
      </small>
      <small>
        ID Waste: {row.id_waste_masuk || '-'} • Plant {row.plant_asal || '-'} • Line {row.line || '-'}
      </small>
      <small>
        Proses: {formatNumber(row.qty_proses_giling)} KG • Bersih:{' '}
        {formatNumber(row.qty_bersih)} KG • PCS: {formatNumber(row.qty_pcs_bersih)} •
        Kotor: {formatNumber(row.qty_kotor)} KG
      </small>
      <small>
        Yield: {formatNumber(row.yield_realisasi)}% • Expired: {row.expired_date || '-'}
      </small>
      <small>{row.keterangan || '-'}</small>
    </div>
  );
}

    if (page === 'pengirimanBersih') {
  return (
    <div className="history-card" key={row.id || `${row.no_batch_bubuk}-${row.jam_input}`}>
      <b>{row.no_batch_bubuk}</b>
      <span>{row.nama_bubuk || '-'}</span>
      <small>
        {row.tanggal} • {row.jam_input || '-'} • {row.shift || '-'}
      </small>
      <small>Expired: {row.expired_date || '-'}</small>
      <small>
        Kirim: {formatNumber(row.qty_kirim)} KG • PCS: {formatNumber(row.qty_pcs_kirim)}
      </small>
      <small>
        Tujuan:{' '}
        {row.tujuan_produksi === 'LAINNYA'
          ? row.tujuan_lainnya || 'LAINNYA'
          : row.tujuan_produksi
          ? `Produksi ${row.tujuan_produksi}`
          : '-'}
      </small>
      {row.no_kendaraan && <small>Kendaraan/Pengambil: {row.no_kendaraan}</small>}
      <small>{row.keterangan || '-'}</small>
    </div>
  );
}

    if (page === 'pengeluaranKotor') {
      return (
        <div className="history-card" key={row.id || `${row.tanggal}-${row.jam_input}`}>
          <b>{row.pembeli === 'LAINNYA' ? row.pembeli_lainnya || 'LAINNYA' : row.pembeli}</b>
          <span>Pengeluaran Waste Kotor</span>
          <small>
            {row.tanggal} • {row.jam_input || '-'} • {row.shift || '-'}
          </small>
          <small>Keluar: {formatNumber(row.qty_jual)} KG</small>
          <small>
            {row.identitas_pengambil ? `Pengambil: ${row.identitas_pengambil}` : row.keterangan || '-'}
          </small>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{title}</h3>
            <p>Auto hari ini, tapi bisa ganti tanggal</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="drawer-filter">
          <label>Tanggal</label>
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
          />
        </div>

        <div className="history-list">
          {loading && <div className="empty-state">Loading history...</div>}
          {!loading && rows.length === 0 && (
            <div className="empty-state">Belum ada data di tanggal ini.</div>
          )}
          {!loading && rows.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

function createWasteRow() {
  return {
    rowId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    search: '',
    selectedWaste: null,
    lineUtama: '',
    subLine: '1',
    qtyMasuk: '',
    keterangan: '',
  };
}

function splitLineMaster(masterLine) {
  const value = String(masterLine || '').trim();
  const upper = value.toUpperCase();

  if (!value) return { lineUtama: '', subLine: '1' };

  if (upper === 'ALL LINE' || upper === 'ALL' || upper === 'SEMUA') {
    return { lineUtama: 'All line', subLine: '' };
  }

  if (/^\d+\.\d+$/.test(value)) {
    const [lineUtama, subLine] = value.split('.');
    return { lineUtama, subLine };
  }

  if (['1', '2', '3', '4', '5'].includes(value)) {
    return { lineUtama: value, subLine: '1' };
  }

  return { lineUtama: 'Lainnya', subLine: value };
}

function previewLine(row) {
  if (!row.lineUtama) return '-';

  if (row.lineUtama === 'Lainnya') {
    return row.subLine || '-';
  }

  if (row.lineUtama === 'All line') {
    return 'All line';
  }

  return row.subLine ? `${row.lineUtama}.${row.subLine}` : row.lineUtama;
}


function App() {
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState(localStorage.getItem('bswp_theme') || 'dark');
  const [clock, setClock] = useState(new Date());
  const [notif, setNotif] = useState(null);
  const [submitting, setSubmitting] = useState(false);

const [historyWasteOpen, setHistoryWasteOpen] = useState(false);
const [historyWasteDate, setHistoryWasteDate] = useState(todayYmd());
const [historyWasteRows, setHistoryWasteRows] = useState([]);
const [loadingHistoryWaste, setLoadingHistoryWaste] = useState(false);

  const [masterWaste, setMasterWaste] = useState([]);
  const [wasteGudang, setWasteGudang] = useState([]);
  const [prosesGiling, setProsesGiling] = useState([]);
  const [stokBubuk, setStokBubuk] = useState([]);
  const [stokKotor, setStokKotor] = useState({
    total_kotor_masuk: 0,
    total_kotor_keluar: 0,
    sisa_waste_kotor: 0,
  });
  const [rincianKotor, setRincianKotor] = useState([]);

  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingGudang, setLoadingGudang] = useState(false);
  const [loadingProses, setLoadingProses] = useState(false);
  const [loadingBubuk, setLoadingBubuk] = useState(false);
  const [loadingKotor, setLoadingKotor] = useState(false);
  const [loadingRincianKotor, setLoadingRincianKotor] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(!!sessionStorage.getItem('bswp_pin'));
  const [pinUser, setPinUser] = useState(sessionStorage.getItem('bswp_pin') || '');
  const [pinDigits, setPinDigits] = useState([]);

  const [opnameUnlocked, setOpnameUnlocked] = useState(!!sessionStorage.getItem('bswp_opname_pin'));
  const [opnamePinDigits, setOpnamePinDigits] = useState([]);
  const [opnameView, setOpnameView] = useState('ALL');
  const [opnameSearch, setOpnameSearch] = useState('');
  const [opnameTab, setOpnameTab] = useState('stok');
  const [selectedOpnameItem, setSelectedOpnameItem] = useState(null);
  const [selectedOpnameGroup, setSelectedOpnameGroup] = useState(null);
  const [opnameActualKg, setOpnameActualKg] = useState('');
  const [opnameActualPcs, setOpnameActualPcs] = useState('');
  const [opnameNote, setOpnameNote] = useState('');
  const [pendingAdjustments, setPendingAdjustments] = useState([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);

  const [masterAdminUnlocked, setMasterAdminUnlocked] = useState(
    sessionStorage.getItem('bswp_master_pin') === MASTER_ADMIN_PIN &&
      sessionStorage.getItem('bswp_master_confirm') === 'YES'
  );
  const [masterAdminPinDigits, setMasterAdminPinDigits] = useState([]);
  const [masterTab, setMasterTab] = useState('supplier');
  const [masterSupplierRows, setMasterSupplierRows] = useState([]);
  const [loadingMasterSupplier, setLoadingMasterSupplier] = useState(false);
  const [masterSupplierForm, setMasterSupplierForm] = useState({
    id: null,
    nama_supplier: '',
    jenis: 'JUAL',
    keterangan: '',
    sort_order: 10,
    is_active: true,
  });
  const [masterWasteAdminRows, setMasterWasteAdminRows] = useState([]);
  const [loadingMasterAdminWaste, setLoadingMasterAdminWaste] = useState(false);
  const [masterWasteForm, setMasterWasteForm] = useState({
    id: null,
    kode_waste: '',
    nama_waste: '',
    kode_bubuk: '',
    nama_bubuk: '',
    uom: 'KG',
    plant: '',
    line: '',
    yield_bersih: '',
    tipe_waste: 'GILING',
    is_active: true,
  });

  const [showRincianKotor, setShowRincianKotor] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState('wasteMasuk');
  const [historyDate, setHistoryDate] = useState(todayYmd());
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedWaste, setSelectedWaste] = useState(null);
  const [areaAsal, setAreaAsal] = useState('');
  const [line, setLine] = useState('');
  const [lineLainnya, setLineLainnya] = useState('');
  const [qtyMasuk, setQtyMasuk] = useState('');
  const [keterangan, setKeterangan] = useState('');

const [kategoriWaste, setKategoriWaste] = useState('');
const [noProKeterangan, setNoProKeterangan] = useState('');
const [wasteRows, setWasteRows] = useState([createWasteRow()]);

  const [searchGiling, setSearchGiling] = useState('');
  const [selectedGiling, setSelectedGiling] = useState(null);
  const [qtyGiling, setQtyGiling] = useState('');
  const [keteranganGiling, setKeteranganGiling] = useState('');

  const [searchHasil, setSearchHasil] = useState('');
  const [selectedHasil, setSelectedHasil] = useState(null);
  const [qtyHasil, setQtyHasil] = useState('');
  const [qtyBersihHasil, setQtyBersihHasil] = useState('');
  const [qtyPcsBersih, setQtyPcsBersih] = useState('');
  const [pcsManualEdited, setPcsManualEdited] = useState(false);
  const [keteranganHasil, setKeteranganHasil] = useState('');

  const [searchKirim, setSearchKirim] = useState('');
  const [selectedKirim, setSelectedKirim] = useState(null);
  const [qtyKirim, setQtyKirim] = useState('');
  const [qtyPcsKirim, setQtyPcsKirim] = useState('');
  const [pcsKirimManualEdited, setPcsKirimManualEdited] = useState(false);
  const [tujuanProduksi, setTujuanProduksi] = useState('');
  const [tujuanLainnya, setTujuanLainnya] = useState('');
  const [noKendaraan, setNoKendaraan] = useState('');
  const [keteranganKirim, setKeteranganKirim] = useState('');

  const [qtyKotorKeluar, setQtyKotorKeluar] = useState('');
  const [pembeliKotor, setPembeliKotor] = useState('');
  const [pembeliKotorLainnya, setPembeliKotorLainnya] = useState('');
  const [identitasPengambilKotor, setIdentitasPengambilKotor] = useState('');
  const [keteranganKotor, setKeteranganKotor] = useState('');

  const [dashStartDate, setDashStartDate] = useState(() => addDaysYmd(-7));
  const [dashEndDate, setDashEndDate] = useState(todayYmd());
  const [dashPlant, setDashPlant] = useState('ALL');
  const [dashLine, setDashLine] = useState('ALL');
  const [dashWasteFlow, setDashWasteFlow] = useState('ALL');
  const [dashSearch, setDashSearch] = useState('');
  const [dashTab, setDashTab] = useState('overview');
  const [dashTvMode, setDashTvMode] = useState(false);
  const [dashAutoRefresh, setDashAutoRefresh] = useState(true);
  const [dashboardWasteMasuk, setDashboardWasteMasuk] = useState([]);
  const [dashboardHasilGiling, setDashboardHasilGiling] = useState([]);
  const [dashboardPengiriman, setDashboardPengiriman] = useState([]);
  const [loadingDashboardAnalytics, setLoadingDashboardAnalytics] = useState(false);
  const [sourceDetail, setSourceDetail] = useState(null);
  const [wasteGudangDetail, setWasteGudangDetail] = useState(null);
  const [livePenerimaanDetail, setLivePenerimaanDetail] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bswp_theme', theme);
  }, [theme]);

  useEffect(() => {
    refreshAll();

    const timer = setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (page !== 'dashboard') return;
    loadDashboardAnalytics();
  }, [page, dashStartDate, dashEndDate]);

  useEffect(() => {
    if (page !== 'stockOpname') return;
    refreshAll();
    loadPendingAdjustments();
    if (rincianKotor.length === 0) {
      loadRincianKotor();
    }
  }, [page]);

  useEffect(() => {
    if (page !== 'masterData') return;
    loadMasterSupplierKotor();
    loadMasterWasteAdmin();
  }, [page]);

  useEffect(() => {
    if (page !== 'stockOpname') return;
    if (opnameTab === 'pending') {
      loadPendingAdjustments();
    }
  }, [page, opnameTab]);

  useEffect(() => {
    if (page !== 'dashboard' || !dashAutoRefresh) return;

    const dashboardTimer = setInterval(() => {
      refreshAll();
      loadDashboardAnalytics();
    }, 60000);

    return () => clearInterval(dashboardTimer);
  }, [page, dashAutoRefresh, dashStartDate, dashEndDate]);

  useEffect(() => {
    if (!historyOpen) return;
    loadHistory(historyPage, historyDate);
  }, [historyOpen, historyPage, historyDate]);

  useEffect(() => {
  if (pcsManualEdited) return;

  const bersih = parseNumber(qtyBersihHasil);

  if (Number.isNaN(bersih) || bersih <= 0) {
    setQtyPcsBersih('');
    return;
  }

  setQtyPcsBersih(String(hitungPcsKantong(bersih)));
}, [qtyBersihHasil, pcsManualEdited]);

useEffect(() => {
  if (!historyWasteOpen) return;
  loadHistoryWasteMasuk(historyWasteDate);
}, [historyWasteDate, historyWasteOpen]);

  useEffect(() => {
    if (pcsKirimManualEdited) return;

    const kirim = parseNumber(qtyKirim);
    if (Number.isNaN(kirim) || kirim <= 0) {
      setQtyPcsKirim('');
      return;
    }

    setQtyPcsKirim(String(hitungPcsKantong(kirim)));
  }, [qtyKirim, pcsKirimManualEdited]);

  async function refreshAll() {
    await Promise.all([
      loadMasterWaste(),
      loadWasteGudang(),
      loadProsesGiling(),
      loadStokBubuk(),
      loadStokKotor(),
      loadMasterSupplierKotor(),
    ]);
  }

  async function loadMasterSupplierKotor() {
    setLoadingMasterSupplier(true);

    const { data, error } = await supabase
      .from('master_supplier_kotor')
      .select('id,nama_supplier,jenis,keterangan,sort_order,is_active,created_at,updated_at')
      .order('sort_order', { ascending: true })
      .order('nama_supplier', { ascending: true });

    if (error) {
      setLoadingMasterSupplier(false);
      setMasterSupplierRows([]);

      if (page === 'masterData') {
        setNotif({
          type: 'error',
          message: `Gagal load master supplier: ${error.message}`,
          detail: 'Pastikan SQL Master Data Admin sudah dijalankan di Supabase.',
        });
      }

      return;
    }

    setMasterSupplierRows(data || []);
    setLoadingMasterSupplier(false);
  }

  async function loadMasterWaste() {
    setLoadingMaster(true);
    const { data, error } = await supabase
      .from('master_waste')
      .select(
        'id,kode_waste,nama_waste,kode_bubuk,nama_bubuk,uom,plant,line,yield_bersih,tipe_waste,is_active'
      )
      .eq('is_active', true)
      .order('nama_waste', { ascending: true });

    if (error) {
      setNotif({ type: 'error', message: `Gagal load master waste: ${error.message}` });
      setLoadingMaster(false);
      return;
    }

    setMasterWaste(data || []);
    setLoadingMaster(false);
  }

  async function loadWasteGudang() {
    setLoadingGudang(true);
    const { data, error } = await supabase
      .from('v_stok_waste_gudang')
      .select('*')
      .gt('sisa_waste_gudang', 0)
      .order('tanggal', { ascending: false });

    if (error) {
      setNotif({ type: 'error', message: `Gagal load stok gudang: ${error.message}` });
      setLoadingGudang(false);
      return;
    }

    setWasteGudang(data || []);
    setLoadingGudang(false);
  }

  async function loadProsesGiling() {
    setLoadingProses(true);
    const { data, error } = await supabase
      .from('v_stok_proses_giling')
      .select('*')
      .gt('sisa_proses_giling', 0)
      .order('id_waste_masuk', { ascending: false });

    if (error) {
      setNotif({ type: 'error', message: `Gagal load proses giling: ${error.message}` });
      setLoadingProses(false);
      return;
    }

    setProsesGiling(data || []);
    setLoadingProses(false);
  }

  async function loadStokBubuk() {
    setLoadingBubuk(true);
    const { data, error } = await supabase
      .from('v_stok_bubuk_bersih')
      .select('*')
      .gt('sisa_bubuk_bersih', 0)
      .order('tanggal', { ascending: false });

    if (error) {
      setNotif({ type: 'error', message: `Gagal load stok bubuk: ${error.message}` });
      setLoadingBubuk(false);
      return;
    }

    setStokBubuk(data || []);
    setLoadingBubuk(false);
  }

  async function loadStokKotor() {
    setLoadingKotor(true);
    const { data, error } = await supabase
      .from('v_stok_waste_kotor')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      setNotif({ type: 'error', message: `Gagal load stok kotor: ${error.message}` });
      setLoadingKotor(false);
      return;
    }

    setStokKotor(
      data || {
        total_kotor_masuk: 0,
        total_kotor_keluar: 0,
        sisa_waste_kotor: 0,
      }
    );
    setLoadingKotor(false);
  }

  async function loadRincianKotor() {
    setLoadingRincianKotor(true);
    const { data, error } = await supabase
      .from('v_rincian_waste_kotor')
      .select('*')
      .order('kategori', { ascending: true })
      .order('nama_item', { ascending: true });

    if (error) {
      setNotif({
        type: 'error',
        message: `Gagal load rincian waste kotor: ${error.message}`,
      });
      setLoadingRincianKotor(false);
      return;
    }

    setRincianKotor(data || []);
    setLoadingRincianKotor(false);
  }


  const supplierKotorOptions = useMemo(() => {
    const activeFromDb = masterSupplierRows
      .filter((item) => item.is_active !== false)
      .map((item) => String(item.nama_supplier || '').trim())
      .filter(Boolean);

    const base = activeFromDb.length ? activeFromDb : PEMBELI_KOTOR_OPTIONS;
    const withoutManual = base.filter((item) => String(item).toUpperCase() !== 'LAINNYA');

    return [...new Set([...withoutManual, 'LAINNYA'])];
  }, [masterSupplierRows]);

  async function loadMasterWasteAdmin() {
    setLoadingMasterAdminWaste(true);

    const { data, error } = await supabase
      .from('master_waste')
      .select('id,kode_waste,nama_waste,kode_bubuk,nama_bubuk,uom,plant,line,yield_bersih,tipe_waste,is_active')
      .order('nama_waste', { ascending: true });

    if (error) {
      setNotif({ type: 'error', message: `Gagal load master waste/bubuk: ${error.message}` });
      setLoadingMasterAdminWaste(false);
      return;
    }

    setMasterWasteAdminRows(data || []);
    setLoadingMasterAdminWaste(false);
  }

  function resetMasterSupplierForm() {
    setMasterSupplierForm({
      id: null,
      nama_supplier: '',
      jenis: 'JUAL',
      keterangan: '',
      sort_order: 10,
      is_active: true,
    });
  }

  function editMasterSupplier(item) {
    setMasterSupplierForm({
      id: item.id,
      nama_supplier: item.nama_supplier || '',
      jenis: item.jenis || 'JUAL',
      keterangan: item.keterangan || '',
      sort_order: Number(item.sort_order || 10),
      is_active: item.is_active !== false,
    });
    setMasterTab('supplier');
  }

  async function saveMasterSupplier(e) {
    e.preventDefault();

    const nama = String(masterSupplierForm.nama_supplier || '').trim().toUpperCase();
    if (!nama) {
      setNotif({ type: 'error', message: 'Nama supplier wajib diisi.' });
      return;
    }

    setSubmitting(true);

    const payload = {
      nama_supplier: nama,
      jenis: masterSupplierForm.jenis || 'JUAL',
      keterangan: masterSupplierForm.keterangan || '',
      sort_order: Number(masterSupplierForm.sort_order || 10),
      is_active: masterSupplierForm.is_active !== false,
      updated_at: new Date().toISOString(),
    };

    const query = masterSupplierForm.id
      ? supabase.from('master_supplier_kotor').update(payload).eq('id', masterSupplierForm.id)
      : supabase.from('master_supplier_kotor').insert(payload);

    const { error } = await query;
    setSubmitting(false);

    if (error) {
      setNotif({ type: 'error', message: `Gagal simpan supplier: ${error.message}` });
      return;
    }

    setNotif({
      type: 'success',
      message: masterSupplierForm.id ? 'Master supplier berhasil diupdate.' : 'Master supplier berhasil ditambahkan.',
    });

    resetMasterSupplierForm();
    await loadMasterSupplierKotor();
  }

  async function toggleMasterSupplierActive(item) {
    const { error } = await supabase
      .from('master_supplier_kotor')
      .update({
        is_active: item.is_active === false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      setNotif({ type: 'error', message: `Gagal update status supplier: ${error.message}` });
      return;
    }

    await loadMasterSupplierKotor();
  }

  function resetMasterWasteForm() {
    setMasterWasteForm({
      id: null,
      kode_waste: '',
      nama_waste: '',
      kode_bubuk: '',
      nama_bubuk: '',
      uom: 'KG',
      plant: '',
      line: '',
      yield_bersih: '',
      tipe_waste: 'GILING',
      is_active: true,
    });
  }

  function editMasterWaste(item) {
    setMasterWasteForm({
      id: item.id,
      kode_waste: item.kode_waste || '',
      nama_waste: item.nama_waste || '',
      kode_bubuk: item.kode_bubuk || '',
      nama_bubuk: item.nama_bubuk || '',
      uom: item.uom || 'KG',
      plant: item.plant || '',
      line: item.line || '',
      yield_bersih: item.yield_bersih ?? '',
      tipe_waste: item.tipe_waste || 'GILING',
      is_active: item.is_active !== false,
    });
    setMasterTab('waste');
  }

  async function saveMasterWasteAdmin(e) {
    e.preventDefault();

    const kodeWaste = String(masterWasteForm.kode_waste || '').trim();
    const namaWaste = String(masterWasteForm.nama_waste || '').trim();

    if (!kodeWaste || !namaWaste) {
      setNotif({ type: 'error', message: 'Kode waste dan nama waste wajib diisi.' });
      return;
    }

    setSubmitting(true);

    const payload = {
      kode_waste: kodeWaste,
      nama_waste: namaWaste.toUpperCase(),
      kode_bubuk: String(masterWasteForm.kode_bubuk || '').trim(),
      nama_bubuk: String(masterWasteForm.nama_bubuk || '').trim().toUpperCase(),
      uom: masterWasteForm.uom || 'KG',
      plant: masterWasteForm.plant || '',
      line: masterWasteForm.line || '',
      yield_bersih: masterWasteForm.yield_bersih === '' ? null : Number(masterWasteForm.yield_bersih || 0),
      tipe_waste: masterWasteForm.tipe_waste || 'GILING',
      is_active: masterWasteForm.is_active !== false,
    };

    const query = masterWasteForm.id
      ? supabase.from('master_waste').update(payload).eq('id', masterWasteForm.id)
      : supabase.from('master_waste').insert(payload);

    const { error } = await query;
    setSubmitting(false);

    if (error) {
      setNotif({ type: 'error', message: `Gagal simpan master waste/bubuk: ${error.message}` });
      return;
    }

    setNotif({
      type: 'success',
      message: masterWasteForm.id ? 'Master waste/bubuk berhasil diupdate.' : 'Master waste/bubuk berhasil ditambahkan.',
    });

    resetMasterWasteForm();
    await Promise.all([loadMasterWasteAdmin(), loadMasterWaste()]);
  }

  async function toggleMasterWasteActive(item) {
    const { error } = await supabase
      .from('master_waste')
      .update({ is_active: item.is_active === false })
      .eq('id', item.id);

    if (error) {
      setNotif({ type: 'error', message: `Gagal update status master waste: ${error.message}` });
      return;
    }

    await Promise.all([loadMasterWasteAdmin(), loadMasterWaste()]);
  }

  async function loadDashboardAnalytics() {
    setLoadingDashboardAnalytics(true);

    const safeStart = dashStartDate || todayYmd();
    const safeEnd = dashEndDate || todayYmd();

    const [wasteResult, hasilResult, kirimResult] = await Promise.all([
      supabase
        .from('waste_masuk')
        .select(
          'id,id_waste_masuk,group_id,tanggal,jam_input,created_at,shift,plant_asal,area_asal,line,kode_waste,nama_waste,tipe_waste,qty_masuk,kategori_waste,no_pro_keterangan,keterangan'
        )
        .gte('tanggal', safeStart)
        .lte('tanggal', safeEnd)
        .order('tanggal', { ascending: true })
        .order('jam_input', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(5000),

      supabase
        .from('v_history_hasil_giling')
        .select('*')
        .gte('tanggal', safeStart)
        .lte('tanggal', safeEnd)
        .order('tanggal', { ascending: true })
        .limit(5000),

      supabase
        .from('v_history_pengiriman_bersih')
        .select('*')
        .gte('tanggal', safeStart)
        .lte('tanggal', safeEnd)
        .order('tanggal', { ascending: true })
        .limit(5000),
    ]);

    if (wasteResult.error || hasilResult.error || kirimResult.error) {
      setNotif({
        type: 'error',
        message:
          wasteResult.error?.message ||
          hasilResult.error?.message ||
          kirimResult.error?.message ||
          'Gagal load dashboard analytics.',
      });
      setLoadingDashboardAnalytics(false);
      return;
    }

    setDashboardWasteMasuk(wasteResult.data || []);
    setDashboardHasilGiling(hasilResult.data || []);
    setDashboardPengiriman(kirimResult.data || []);
    setLoadingDashboardAnalytics(false);
  }

 async function loadHistory(currentPage, currentDate) {
  setHistoryLoading(true);

  let query = null;

  if (currentPage === 'prosesGiling') {
    query = supabase
      .from('v_history_proses_giling')
      .select('*')
      .eq('tanggal', currentDate)
      .order('jam_input', { ascending: false });
  }

  if (currentPage === 'hasilGiling') {
    query = supabase
      .from('v_history_hasil_giling')
      .select('*')
      .eq('tanggal', currentDate)
      .order('jam_input', { ascending: false });
  }

  if (currentPage === 'pengirimanBersih') {
    query = supabase
      .from('v_history_pengiriman_bersih')
      .select('*')
      .eq('tanggal', currentDate)
      .order('jam_input', { ascending: false });
  }

  if (currentPage === 'pengeluaranKotor') {
    query = supabase
      .from('v_history_pengeluaran_kotor')
      .select('*')
      .eq('tanggal', currentDate)
      .order('jam_input', { ascending: false });
  }

  if (!query) {
    setHistoryRows([]);
    setHistoryLoading(false);
    return;
  }

  const { data, error } = await query;

  if (error) {
    setNotif({ type: 'error', message: `Gagal load history: ${error.message}` });
    setHistoryRows([]);
    setHistoryLoading(false);
    return;
  }

  setHistoryRows(data || []);
  setHistoryLoading(false);
} 

  function openHistory(targetPage) {
    setHistoryPage(targetPage);
    setHistoryDate(todayYmd());
    setHistoryOpen(true);
  }

  const filteredWaste = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return [];

    return masterWaste
      .filter((item) => {
        const text = `
          ${item.kode_waste || ''}
          ${item.nama_waste || ''}
          ${item.kode_bubuk || ''}
          ${item.nama_bubuk || ''}
          ${item.plant || ''}
          ${item.line || ''}
          ${item.tipe_waste || ''}
        `.toLowerCase();

        return text.includes(keyword);
      })
      .slice(0, 20);
  }, [search, masterWaste]);

  const filteredGiling = useMemo(() => {
    const keyword = searchGiling.trim().toLowerCase();
    if (!keyword) return [];

    return wasteGudang
      .filter((item) => {
        const text = `
          ${item.id_waste_masuk || ''}
          ${item.kode_waste || ''}
          ${item.nama_waste || ''}
          ${item.plant_asal || ''}
          ${item.area_asal || ''}
          ${item.line || ''}
        `.toLowerCase();

        return text.includes(keyword);
      })
      .slice(0, 20);
  }, [searchGiling, wasteGudang]);

  const filteredHasil = useMemo(() => {
    const keyword = searchHasil.trim().toLowerCase();
    if (!keyword) return [];

    return prosesGiling
      .filter((item) => {
        const text = `
          ${item.id_waste_masuk || ''}
          ${item.kode_waste || ''}
          ${item.nama_waste || ''}
          ${item.kode_bubuk || ''}
          ${item.nama_bubuk || ''}
          ${item.plant_asal || ''}
          ${item.area_asal || ''}
          ${item.line || ''}
        `.toLowerCase();

        return text.includes(keyword);
      })
      .slice(0, 20);
  }, [searchHasil, prosesGiling]);

  const filteredKirim = useMemo(() => {
    const keyword = searchKirim.trim().toLowerCase();
    if (!keyword) return [];

    return stokBubuk
      .filter((item) => {
        const text = `
          ${item.no_batch_bubuk || ''}
          ${item.nama_bubuk || ''}
          ${item.kode_bubuk || ''}
          ${item.id_waste_masuk || ''}
        `.toLowerCase();

        return text.includes(keyword);
      })
      .slice(0, 20);
  }, [searchKirim, stokBubuk]);

  function clearAllNotifs() {
    setNotif(null);
  }

  function resetWasteMasukForm() {
    setSearch('');
    setSelectedWaste(null);
    setAreaAsal('');
    setLine('');
    setLineLainnya('');
    setQtyMasuk('');
    setKeterangan('');
  }

  function resetGilingForm() {
    setSearchGiling('');
    setSelectedGiling(null);
    setQtyGiling('');
    setKeteranganGiling('');
  }

  function resetHasilForm() {
    setSearchHasil('');
    setSelectedHasil(null);
    setQtyHasil('');
    setQtyBersihHasil('');
    setQtyPcsBersih('');
    setPcsManualEdited(false);
    setKeteranganHasil('');
  }

  function resetKirimForm() {
    setSearchKirim('');
    setSelectedKirim(null);
    setQtyKirim('');
    setQtyPcsKirim('');
    setPcsKirimManualEdited(false);
    setTujuanProduksi('');
    setTujuanLainnya('');
    setNoKendaraan('');
    setKeteranganKirim('');
  }

  function resetKotorForm() {
    setQtyKotorKeluar('');
    setPembeliKotor('');
    setPembeliKotorLainnya('');
    setIdentitasPengambilKotor('');
    setKeteranganKotor('');
  }

function openFormMenu() {
  if (isUnlocked) {
    setPage('formMenu');
    return;
  }

  setPage('pinForm');
  setPinDigits([]);
  setNotif(null);
}

function openStockOpname() {
  if (opnameUnlocked) {
    setPage('stockOpname');
    return;
  }

  setPage('opnamePin');
  setOpnamePinDigits([]);
  setNotif(null);
}

function handleOpnamePinPress(value) {
  clearAllNotifs();

  if (opnamePinDigits.length >= 4) return;

  const next = [...opnamePinDigits, value];
  setOpnamePinDigits(next);

  if (next.length === 4) {
    const entered = next.join('');
    setTimeout(() => {
      if (entered === OPNAME_PIN) {
        sessionStorage.setItem('bswp_opname_pin', entered);
        setOpnameUnlocked(true);
        setOpnamePinDigits([]);
        setPage('stockOpname');
      } else {
        setNotif({ type: 'error', message: 'PIN Stock Opname salah.' });
        setOpnamePinDigits([]);
      }
    }, 120);
  }
}

function handleOpnamePinBackspace() {
  clearAllNotifs();
  setOpnamePinDigits((prev) => prev.slice(0, -1));
}

function lockStockOpname() {
  sessionStorage.removeItem('bswp_opname_pin');
  setOpnameUnlocked(false);
  setOpnamePinDigits([]);
  setPage('home');
  setNotif(null);
}

function openMasterDataAdmin() {
  if (masterAdminUnlocked) {
    setPage('masterData');
    return;
  }

  setPage('masterAdminPin');
  setMasterAdminPinDigits([]);
  setNotif(null);
}

function handleMasterAdminPinPress(value) {
  clearAllNotifs();

  if (masterAdminPinDigits.length >= 5) return;

  const next = [...masterAdminPinDigits, value];
  setMasterAdminPinDigits(next);

  if (next.length === 5) {
    const entered = next.join('');

    setTimeout(() => {
      if (entered === MASTER_ADMIN_PIN) {
        setMasterAdminPinDigits([]);
        setPage('masterAdminConfirm');
      } else {
        setNotif({ type: 'error', message: 'PIN Master Data Admin salah.' });
        setMasterAdminPinDigits([]);
      }
    }, 120);
  }
}

function handleMasterAdminPinBackspace() {
  clearAllNotifs();
  setMasterAdminPinDigits((prev) => prev.slice(0, -1));
}

function confirmMasterAdminAccess() {
  sessionStorage.setItem('bswp_master_pin', MASTER_ADMIN_PIN);
  sessionStorage.setItem('bswp_master_confirm', 'YES');
  setMasterAdminUnlocked(true);
  setPage('masterData');
  setNotif({
    type: 'success',
    message: 'Akses Master Data Admin dibuka.',
    detail: 'Area inti sistem aktif. Semua perubahan master data akan mempengaruhi dropdown dan input.',
  });
}

function cancelMasterAdminAccess() {
  sessionStorage.removeItem('bswp_master_pin');
  sessionStorage.removeItem('bswp_master_confirm');
  setMasterAdminUnlocked(false);
  setMasterAdminPinDigits([]);
  setPage('home');
  setNotif(null);
}

function lockMasterDataAdmin() {
  sessionStorage.removeItem('bswp_master_pin');
  sessionStorage.removeItem('bswp_master_confirm');
  setMasterAdminUnlocked(false);
  setMasterAdminPinDigits([]);
  setPage('home');
  setNotif(null);
}

  function handlePinPress(value) {
    clearAllNotifs();

    if (pinDigits.length >= 4) return;

    const next = [...pinDigits, value];
    setPinDigits(next);

    if (next.length === 4) {
      const entered = next.join('');
      setTimeout(() => {
        if (entered === APP_PIN) {
  sessionStorage.setItem('bswp_pin', entered);
  setPinUser(entered);
  setIsUnlocked(true);
  setPinDigits([]);
  setPage('formMenu');
}
else {
          setNotif({ type: 'error', message: 'Kata sandi salah.' });
          setPinDigits([]);
        }
      }, 120);
    }
  }

  function handlePinBackspace() {
    clearAllNotifs();
    setPinDigits((prev) => prev.slice(0, -1));
  }

  function lockApp() {
  sessionStorage.removeItem('bswp_pin');
  sessionStorage.removeItem('bswp_opname_pin');
  sessionStorage.removeItem('bswp_master_pin');
  sessionStorage.removeItem('bswp_master_confirm');
  setPinUser('');
  setIsUnlocked(false);
  setOpnameUnlocked(false);
  setMasterAdminUnlocked(false);
  setPinDigits([]);
  setOpnamePinDigits([]);
  setMasterAdminPinDigits([]);
  setPage('home');
  setNotif(null);
}

function updateWasteRow(rowId, patch) {
  setWasteRows((prev) =>
    prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
  );
}

function addWasteRow() {
  setWasteRows((prev) => [...prev, createWasteRow()]);
}

function removeWasteRow(rowId) {
  setWasteRows((prev) => {
    if (prev.length <= 1) return prev;
    return prev.filter((row) => row.rowId !== rowId);
  });
}

function clearWasteRow(rowId) {
  setWasteRows((prev) =>
    prev.map((row) => (row.rowId === rowId ? createWasteRow() : row))
  );
}

function chooseWasteRow(rowId, item) {
  const lineDefault = splitLineMaster(item.line);

  updateWasteRow(rowId, {
    selectedWaste: item,
    search: `${item.kode_waste} - ${item.nama_waste}`,
    lineUtama: lineDefault.lineUtama,
    subLine: lineDefault.subLine,
  });
}

function getFilteredWasteByKeyword(keyword) {
  const key = String(keyword || '').trim().toLowerCase();
  if (!key) return [];

  return masterWaste
    .filter((item) => {
      const text = `
        ${item.kode_waste || ''}
        ${item.nama_waste || ''}
        ${item.kode_bubuk || ''}
        ${item.nama_bubuk || ''}
        ${item.plant || ''}
        ${item.line || ''}
        ${item.tipe_waste || ''}
      `.toLowerCase();

      return text.includes(key);
    })
    .slice(0, 15);
}

function resetWasteMasukBatchForm() {
  setKategoriWaste('');
  setNoProKeterangan('');
  setAreaAsal('');
  setWasteRows([createWasteRow()]);
}

async function loadHistoryWasteMasuk(dateValue = historyWasteDate) {
  setLoadingHistoryWaste(true);

  const { data, error } = await supabase
    .from('v_history_waste_masuk_group')
    .select('*')
    .eq('tanggal', dateValue)
    .order('jam_input', { ascending: false });

  if (error) {
    setNotif({
      type: 'error',
      message: `Gagal load history waste masuk: ${error.message}`,
    });
    setLoadingHistoryWaste(false);
    return;
  }

  setHistoryWasteRows(data || []);
  setLoadingHistoryWaste(false);
}

async function openHistoryWasteMasuk() {
  const today = todayYmd();
  setHistoryWasteDate(today);
  setHistoryWasteOpen(true);
  await loadHistoryWasteMasuk(today);
}

  async function submitWasteMasuk(e) {
  e.preventDefault();
  setNotif(null);

  if (!pinUser.trim()) {
    setNotif({ type: 'error', message: 'PIN belum login.' });
    return;
  }

  if (!kategoriWaste) {
    setNotif({ type: 'error', message: 'Kategori waste wajib dipilih.' });
    return;
  }

  if (!noProKeterangan.trim()) {
    setNotif({ type: 'error', message: 'No PRO / Keterangan wajib diisi.' });
    return;
  }

  if (!areaAsal) {
    setNotif({ type: 'error', message: 'Area asal wajib dipilih.' });
    return;
  }

  const validRows = wasteRows.filter(
    (row) =>
      row.selectedWaste ||
      row.search ||
      row.qtyMasuk ||
      row.keterangan ||
      row.lineUtama
  );

  if (validRows.length === 0) {
    setNotif({ type: 'error', message: 'Minimal harus ada 1 detail waste.' });
    return;
  }

  const items = [];

  for (let i = 0; i < validRows.length; i += 1) {
    const row = validRows[i];
    const nomor = i + 1;
    const qty = parseNumber(row.qtyMasuk);

    if (!row.selectedWaste) {
      setNotif({ type: 'error', message: `Waste baris ${nomor} belum dipilih.` });
      return;
    }

    if (!row.lineUtama) {
      setNotif({ type: 'error', message: `Line baris ${nomor} wajib dipilih.` });
      return;
    }

    if (row.lineUtama === 'Lainnya' && !row.subLine.trim()) {
      setNotif({
        type: 'error',
        message: `Line manual baris ${nomor} wajib diisi.`,
      });
      return;
    }

    if (row.lineUtama !== 'All line' && row.lineUtama !== 'Lainnya' && !row.subLine.trim()) {
      setNotif({
        type: 'error',
        message: `Sub line baris ${nomor} wajib diisi. Contoh: Line 1 . Sub 1 = 1.1`,
      });
      return;
    }

    if (Number.isNaN(qty) || qty <= 0) {
      setNotif({
        type: 'error',
        message: `Qty baris ${nomor} harus lebih dari 0.`,
      });
      return;
    }

    items.push({
      master_waste_id: row.selectedWaste.id,
      line_utama: row.lineUtama,
      sub_line: row.lineUtama === 'All line' ? '' : row.subLine,
      qty_masuk: qty,
      keterangan: row.keterangan || '',
    });
  }

  setSubmitting(true);

  const { data, error } = await supabase.rpc('submit_waste_masuk_batch', {
    p_kategori_waste: kategoriWaste,
    p_no_pro_keterangan: noProKeterangan.trim(),
    p_area_asal: areaAsal,
    p_items: items,
    p_created_by: pinUser.trim(),
  });

  setSubmitting(false);

  if (error) {
    setNotif({
      type: 'error',
      message: `Gagal simpan batch waste: ${error.message}`,
    });
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;

  setNotif({
    type: 'success',
    message: result?.message || 'Waste masuk batch berhasil disimpan.',
    detail: `Group: ${result?.group_id || '-'} • Item: ${
      result?.total_item || 0
    } • Total: ${formatNumber(result?.total_qty)} KG • ${result?.shift || '-'}`,
  });

  resetWasteMasukBatchForm();
  await refreshAll();
}

  async function submitProsesGiling(e) {
    e.preventDefault();
    clearAllNotifs();

    if (!selectedGiling) {
      setNotif({ type: 'error', message: 'Pilih ID waste dulu.' });
      return;
    }

    const qty = parseNumber(qtyGiling);
    const sisa = Number(selectedGiling.sisa_waste_gudang || 0);

    if (Number.isNaN(qty) || qty <= 0) {
      setNotif({ type: 'error', message: 'Qty giling harus lebih dari 0.' });
      return;
    }

    if (qty > sisa) {
      setNotif({
        type: 'error',
        message: `Qty melebihi sisa gudang. Sisa saat ini ${formatNumber(sisa)} KG.`,
      });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc('submit_proses_giling', {
      p_id_waste_masuk: selectedGiling.id_waste_masuk,
      p_qty_masuk_giling: qty,
      p_keterangan: keteranganGiling || '',
      p_created_by: pinUser,
    });

    setSubmitting(false);

    if (error) {
      setNotif({ type: 'error', message: `Gagal simpan proses giling: ${error.message}` });
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setNotif({
      type: 'success',
      message: result?.message || 'Proses giling berhasil disimpan.',
      detail: `ID: ${result?.id_waste_masuk || '-'} • Qty: ${formatNumber(
        result?.qty_masuk_giling
      )} KG`,
    });

    resetGilingForm();
    await refreshAll();
  }

  async function submitHasilGiling(e) {
    e.preventDefault();
    clearAllNotifs();

    if (!selectedHasil) {
      setNotif({ type: 'error', message: 'Pilih ID proses giling dulu.' });
      return;
    }

    const qty = parseNumber(qtyHasil);
    const qtyBersih = parseNumber(qtyBersihHasil);
    const qtyPcs = parseNumber(qtyPcsBersih);
    const sisa = Number(selectedHasil.sisa_proses_giling || 0);

    if (Number.isNaN(qty) || qty <= 0) {
      setNotif({ type: 'error', message: 'Qty selesai digiling harus lebih dari 0.' });
      return;
    }

    if (qty > sisa) {
      setNotif({
        type: 'error',
        message: `Qty melebihi sisa proses giling. Sisa saat ini ${formatNumber(sisa)} KG.`,
      });
      return;
    }

    if (Number.isNaN(qtyBersih) || qtyBersih < 0) {
      setNotif({ type: 'error', message: 'Qty bubuk bersih wajib diisi.' });
      return;
    }

    if (qtyBersih > qty) {
      setNotif({
        type: 'error',
        message: 'Qty bersih tidak boleh lebih besar dari qty proses.',
      });
      return;
    }

    if (Number.isNaN(qtyPcs) || qtyPcs < 0) {
      setNotif({ type: 'error', message: 'Qty PCS bersih wajib diisi.' });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc('submit_hasil_giling', {
      p_id_waste_masuk: selectedHasil.id_waste_masuk,
      p_qty_proses_giling: qty,
      p_qty_bersih: qtyBersih,
      p_qty_pcs_bersih: qtyPcs,
      p_keterangan: keteranganHasil || '',
      p_created_by: pinUser,
    });

    setSubmitting(false);

    if (error) {
      setNotif({ type: 'error', message: `Gagal simpan hasil giling: ${error.message}` });
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setNotif({
      type: 'success',
      message: result?.message || 'Hasil giling berhasil disimpan.',
      detail: `Batch: ${result?.no_batch_bubuk || '-'} • Bersih ${formatNumber(
        result?.qty_bersih
      )} KG • Kotor ${formatNumber(result?.qty_kotor)} KG`,
    });

    resetHasilForm();
    await refreshAll();
  }

  async function submitPengirimanBersih(e) {
    e.preventDefault();
    clearAllNotifs();

    if (!selectedKirim) {
      setNotif({ type: 'error', message: 'Pilih batch bubuk dulu.' });
      return;
    }

    const qty = parseNumber(qtyKirim);
    const qtyPcs = parseNumber(qtyPcsKirim);
    const sisaKg = Number(selectedKirim.sisa_bubuk_bersih || 0);
    const sisaPcs = Number(selectedKirim.sisa_pcs_bersih || 0);

    if (Number.isNaN(qty) || qty <= 0) {
      setNotif({ type: 'error', message: 'Qty kirim harus lebih dari 0.' });
      return;
    }

    if (qty > sisaKg) {
      setNotif({
        type: 'error',
        message: `Qty kirim melebihi stok. Sisa saat ini ${formatNumber(sisaKg)} KG.`,
      });
      return;
    }

    if (!tujuanProduksi) {
      setNotif({ type: 'error', message: 'Tujuan produksi wajib dipilih.' });
      return;
    }

    if (tujuanProduksi === 'LAINNYA' && !tujuanLainnya.trim()) {
      setNotif({ type: 'error', message: 'Tujuan lainnya wajib diisi.' });
      return;
    }

    if (tujuanProduksi === 'LAINNYA' && !noKendaraan.trim()) {
      setNotif({
        type: 'error',
        message: 'No kendaraan / identitas pengambil wajib diisi jika pilih Lainnya.',
      });
      return;
    }

    let pcsWarning = '';
    if (!Number.isNaN(qtyPcs) && qtyPcs < 0) {
      pcsWarning = 'Warning: Qty PCS minus, mohon cek ulang.';
    } else if (!Number.isNaN(qtyPcs) && qtyPcs > sisaPcs) {
      pcsWarning = `Warning: Qty PCS melebihi stok PCS sistem (${formatNumber(sisaPcs)}).`;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc('submit_pengiriman_bersih', {
      p_no_batch_bubuk: selectedKirim.no_batch_bubuk,
      p_qty_kirim: qty,
      p_qty_pcs_kirim: Number.isNaN(qtyPcs) ? 0 : qtyPcs,
      p_tujuan_produksi: tujuanProduksi,
      p_tujuan_lainnya: tujuanLainnya || '',
      p_no_kendaraan: tujuanProduksi === 'LAINNYA' ? noKendaraan : '',
      p_keterangan: keteranganKirim || '',
      p_created_by: pinUser,
    });

    setSubmitting(false);

    if (error) {
      setNotif({ type: 'error', message: `Gagal simpan pengiriman: ${error.message}` });
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setNotif({
      type: 'success',
      message: result?.message || 'Pengiriman berhasil disimpan.',
      detail: `Batch: ${result?.no_batch_bubuk || '-'} • Kirim ${formatNumber(
        result?.qty_kirim
      )} KG • PCS ${formatNumber(result?.qty_pcs_kirim)}${
        pcsWarning ? ` • ${pcsWarning}` : ''
      }`,
    });

    resetKirimForm();
    await refreshAll();
  }

  async function submitPengeluaranKotor(e) {
    e.preventDefault();
    clearAllNotifs();

    const qty = parseNumber(qtyKotorKeluar);
    const sisa = Number(stokKotor?.sisa_waste_kotor || 0);

    if (Number.isNaN(qty) || qty <= 0) {
      setNotif({ type: 'error', message: 'Qty keluar waste kotor harus lebih dari 0.' });
      return;
    }

    if (qty > sisa) {
      setNotif({
        type: 'error',
        message: `Qty keluar melebihi stok waste kotor. Sisa saat ini ${formatNumber(sisa)} KG.`,
      });
      return;
    }

    if (!pembeliKotor) {
      setNotif({ type: 'error', message: 'Pembeli / tujuan wajib dipilih.' });
      return;
    }

    if (pembeliKotor === 'LAINNYA' && !pembeliKotorLainnya.trim()) {
      setNotif({ type: 'error', message: 'Pembeli lainnya wajib diisi.' });
      return;
    }

    if (pembeliKotor === 'LAINNYA' && !identitasPengambilKotor.trim()) {
      setNotif({
        type: 'error',
        message: 'Identitas pengambil wajib diisi jika pilih Lainnya.',
      });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc('submit_pengeluaran_kotor', {
      p_qty_keluar: qty,
      p_pembeli: pembeliKotor,
      p_pembeli_lainnya: pembeliKotorLainnya || '',
      p_identitas_pengambil: identitasPengambilKotor || '',
      p_keterangan: keteranganKotor || '',
      p_created_by: pinUser,
    });

    setSubmitting(false);

    if (error) {
      setNotif({
        type: 'error',
        message: `Gagal simpan pengeluaran kotor: ${error.message}`,
      });
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    setNotif({
      type: 'success',
      message: result?.message || 'Pengeluaran waste kotor berhasil disimpan.',
      detail: `Keluar ${formatNumber(result?.qty_keluar)} KG • Sisa ${formatNumber(
        result?.sisa_sesudah
      )} KG`,
    });

    resetKotorForm();
    await refreshAll();
  }



const dashboardSummary = useMemo(() => {
  const totalWasteGudang = wasteGudang.reduce(
    (sum, item) => sum + Number(item.sisa_waste_gudang || 0),
    0
  );

  const totalProses = prosesGiling.reduce(
    (sum, item) => sum + Number(item.sisa_proses_giling || 0),
    0
  );

  const totalBubukKg = stokBubuk.reduce(
    (sum, item) => sum + Number(item.sisa_bubuk_bersih || 0),
    0
  );

  const totalBubukPcs = stokBubuk.reduce(
    (sum, item) => sum + Number(item.sisa_pcs_bersih || 0),
    0
  );

  return {
    totalWasteGudang,
    totalWasteGudangId: wasteGudang.length,
    totalProses,
    totalProsesId: prosesGiling.length,
    totalBubukKg,
    totalBubukPcs,
    totalBatch: stokBubuk.length,
    totalKotor: Number(stokKotor?.sisa_waste_kotor || 0),
  };
}, [wasteGudang, prosesGiling, stokBubuk, stokKotor]);

function getExpiredStatus(expiredDate) {
  if (!expiredDate) {
    return { label: 'Tanpa expired', className: 'expired-neutral', days: null, level: 'none' };
  }

  const today = new Date();
  const exp = new Date(`${expiredDate}T00:00:00`);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Expired', className: 'expired-danger-dark', days: diffDays, level: 'expired' };
  if (diffDays <= 30) return { label: `${diffDays} hari lagi`, className: 'expired-danger', days: diffDays, level: '1bulan' };
  if (diffDays <= 90) return { label: `${diffDays} hari lagi`, className: 'expired-warning', days: diffDays, level: '3bulan' };

  return { label: 'Aman', className: 'expired-safe', days: diffDays, level: 'aman' };
}

const dashboardFiltered = useMemo(() => {
  const key = toKeyText(dashSearch);

  function matchCommon(item) {
    const plant = String(item.plant_asal || item.plant || '').toUpperCase();
    const lineValue = String(item.line || '').toUpperCase();

    const plantOk = dashPlant === 'ALL' || plant === dashPlant;
    const lineOk = dashLine === 'ALL' || lineValue === dashLine || lineValue.startsWith(`${dashLine}.`);
    const searchOk =
      !key ||
      toKeyText(
        `${item.id_waste_masuk || ''} ${item.group_id || ''} ${item.no_pro_keterangan || ''} ${
          item.no_batch_bubuk || ''
        } ${item.nama_waste || ''} ${item.nama_bubuk || ''} ${item.kode_waste || ''} ${item.kode_bubuk || ''}`
      ).includes(key);

    return plantOk && lineOk && searchOk;
  }

  function matchFlow(item, moduleType) {
    if (dashWasteFlow === 'ALL') return true;

    const tipeText = String(
      item.tipe_waste ||
        item.sumber_kotor ||
        item.kategori ||
        item.kategori_waste ||
        ''
    ).toUpperCase();

    const isDirectKotor = tipeText.includes('KOTOR');

    if (dashWasteFlow === 'KOTOR') {
      return isDirectKotor;
    }

    if (dashWasteFlow === 'GILING') {
      if (['hasilGiling', 'pengiriman', 'prosesGiling', 'stokBubuk'].includes(moduleType)) {
        return true;
      }

      return tipeText.includes('GILING') || !isDirectKotor;
    }

    return true;
  }

  return {
    wasteMasuk: dashboardWasteMasuk.filter((item) => matchCommon(item) && matchFlow(item, 'wasteMasuk')),
    hasilGiling: dashboardHasilGiling.filter((item) => matchCommon(item) && matchFlow(item, 'hasilGiling')),
    pengiriman: dashboardPengiriman.filter((item) => matchCommon(item) && matchFlow(item, 'pengiriman')),
    wasteGudang: wasteGudang.filter((item) => matchCommon(item) && matchFlow(item, 'wasteGudang')),
    prosesGiling: prosesGiling.filter((item) => matchCommon(item) && matchFlow(item, 'prosesGiling')),
    stokBubuk: stokBubuk.filter((item) => matchCommon(item) && matchFlow(item, 'stokBubuk')),
  };
}, [
  dashSearch,
  dashPlant,
  dashLine,
  dashWasteFlow,
  dashboardWasteMasuk,
  dashboardHasilGiling,
  dashboardPengiriman,
  wasteGudang,
  prosesGiling,
  stokBubuk,
]);

function buildTopList(rows, nameKey, qtyKey, limit = 8) {
  const map = new Map();

  rows.forEach((row) => {
    const name = row[nameKey] || '-';
    const old = map.get(name) || { name, qty: 0, count: 0 };
    old.qty += Number(row[qtyKey] || 0);
    old.count += 1;
    map.set(name, old);
  });

  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

const dashboardTopWasteMasuk = useMemo(
  () => buildTopList(dashboardFiltered.wasteMasuk, 'nama_waste', 'qty_masuk', 10),
  [dashboardFiltered.wasteMasuk]
);

const dashboardTopWasteCurrent = useMemo(
  () => buildTopList(dashboardFiltered.wasteGudang, 'nama_waste', 'sisa_waste_gudang', 10),
  [dashboardFiltered.wasteGudang]
);

const dashboardWasteGudangByJenis = useMemo(() => {
  const map = new Map();

  dashboardFiltered.wasteGudang.forEach((item) => {
    const kode = item.kode_waste || '-';
    const nama = item.nama_waste || '-';
    const tipe = item.tipe_waste || '-';
    const key = `${kode}||${nama}||${tipe}`;
    const old = map.get(key) || {
      key,
      kode,
      nama,
      tipe,
      qty: 0,
      count: 0,
      plantSet: new Set(),
      lineSet: new Set(),
      details: [],
    };

    old.qty += Number(item.sisa_waste_gudang || 0);
    old.count += 1;
    old.plantSet.add(item.plant_asal || item.plant || '-');
    old.lineSet.add(item.line || '-');
    old.details.push(item);
    map.set(key, old);
  });

  return [...map.values()]
    .map((item) => ({
      ...item,
      plants: [...item.plantSet].filter(Boolean).join(', '),
      lines: [...item.lineSet].filter(Boolean).join(', '),
      details: item.details.sort((a, b) => {
        const aa = `${a.tanggal || ''} ${a.jam_input || ''} ${a.created_at || ''} ${a.id_waste_masuk || ''}`;
        const bb = `${b.tanggal || ''} ${b.jam_input || ''} ${b.created_at || ''} ${b.id_waste_masuk || ''}`;
        return aa.localeCompare(bb);
      }),
    }))
    .sort((a, b) => b.qty - a.qty);
}, [dashboardFiltered.wasteGudang]);

const dashboardLivePenerimaanByShift = useMemo(() => {
  const base = ['SHIFT 1', 'SHIFT 2', 'SHIFT 3'].map((shift) => ({
    shift,
    qty: 0,
    count: 0,
    details: [],
  }));

  const map = new Map(base.map((item) => [item.shift, item]));

  [...dashboardFiltered.wasteMasuk]
    .sort((a, b) => {
      const aa = `${a.tanggal || ''} ${a.jam_input || ''} ${a.created_at || ''} ${a.id || ''}`;
      const bb = `${b.tanggal || ''} ${b.jam_input || ''} ${b.created_at || ''} ${b.id || ''}`;
      return aa.localeCompare(bb);
    })
    .forEach((item) => {
      const shift = String(item.shift || '-').toUpperCase();
      const key = shift.includes('1') ? 'SHIFT 1' : shift.includes('2') ? 'SHIFT 2' : shift.includes('3') ? 'SHIFT 3' : shift;
      const old = map.get(key) || { shift: key, qty: 0, count: 0, details: [] };
      old.qty += Number(item.qty_masuk || 0);
      old.count += 1;
      old.details.push(item);
      map.set(key, old);
    });

  return [...map.values()].sort((a, b) => {
    const order = { 'SHIFT 1': 1, 'SHIFT 2': 2, 'SHIFT 3': 3 };
    return (order[a.shift] || 99) - (order[b.shift] || 99);
  });
}, [dashboardFiltered.wasteMasuk]);

const dashboardTopKirim = useMemo(
  () => buildTopList(dashboardFiltered.pengiriman, 'nama_bubuk', 'qty_kirim', 10),
  [dashboardFiltered.pengiriman]
);

const dashboardTrend = useMemo(() => {
  const map = new Map();

  function ensure(date) {
    const key = date || '-';
    const old = map.get(key) || {
      tanggal: key,
      wasteMasuk: 0,
      hasilBersih: 0,
      wasteKotor: 0,
      pengiriman: 0,
    };
    map.set(key, old);
    return old;
  }

  dashboardFiltered.wasteMasuk.forEach((item) => {
    ensure(item.tanggal).wasteMasuk += Number(item.qty_masuk || 0);
  });

  dashboardFiltered.hasilGiling.forEach((item) => {
    const row = ensure(item.tanggal);
    row.hasilBersih += Number(item.qty_bersih || 0);
    row.wasteKotor += Number(item.qty_kotor || 0);
  });

  dashboardFiltered.pengiriman.forEach((item) => {
    ensure(item.tanggal).pengiriman += Number(item.qty_kirim || 0);
  });

  return [...map.values()].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
}, [dashboardFiltered]);

const dashboardTrendSummary = useMemo(() => {
  const totalWasteMasuk = dashboardFiltered.wasteMasuk.reduce(
    (sum, item) => sum + Number(item.qty_masuk || 0),
    0
  );
  const totalWasteTergiling = dashboardFiltered.hasilGiling.reduce(
    (sum, item) => sum + Number(item.qty_proses_giling || 0),
    0
  );
  const totalHasilBersih = dashboardFiltered.hasilGiling.reduce(
    (sum, item) => sum + Number(item.qty_bersih || 0),
    0
  );
  const totalWasteKotor = dashboardFiltered.hasilGiling.reduce(
    (sum, item) => sum + Number(item.qty_kotor || 0),
    0
  );
  const totalPengiriman = dashboardFiltered.pengiriman.reduce(
    (sum, item) => sum + Number(item.qty_kirim || 0),
    0
  );

  const ratioText = makeRatio([totalWasteMasuk, totalWasteTergiling, totalPengiriman]);
  const tergilingPct = totalWasteMasuk > 0 ? (totalWasteTergiling / totalWasteMasuk) * 100 : 0;
  const bonPct = totalWasteMasuk > 0 ? (totalPengiriman / totalWasteMasuk) * 100 : 0;
  const yieldPct = totalWasteTergiling > 0 ? (totalHasilBersih / totalWasteTergiling) * 100 : 0;
  const releasePct = totalHasilBersih > 0 ? (totalPengiriman / totalHasilBersih) * 100 : 0;

  let conclusion = 'Belum ada data cukup untuk membaca flow waste.';
  if (totalWasteMasuk > 0) {
    if (tergilingPct < 35) {
      conclusion = 'Waste masuk tinggi, namun yang selesai tergiling masih rendah. Prioritaskan proses giling/FIFO supaya stok waste tidak menumpuk.';
    } else if (releasePct < 35) {
      conclusion = 'Hasil bersih sudah terbentuk, tetapi pengiriman/bon masih rendah. Cek kebutuhan produksi atau jadwalkan pengeluaran bubuk bersih.';
    } else if (yieldPct < 70) {
      conclusion = 'Yield bersih terlihat rendah. Perlu cek kualitas waste, setup crusher/giling, dan penyebab kotor tinggi.';
    } else {
      conclusion = 'Flow waste cukup seimbang: waste masuk, hasil giling, dan pengiriman masih bergerak sehat.';
    }
  }

  return {
    totalWasteMasuk,
    totalWasteTergiling,
    totalHasilBersih,
    totalWasteKotor,
    totalPengiriman,
    ratioText,
    tergilingPct,
    bonPct,
    yieldPct,
    releasePct,
    conclusion,
    comparisonData: [
      { name: 'Waste Masuk', qty: totalWasteMasuk },
      { name: 'Waste Tergiling', qty: totalWasteTergiling },
      { name: 'Bubuk Dibon', qty: totalPengiriman },
    ],
  };
}, [dashboardFiltered]);

const dashboardHasilByShift = useMemo(() => {
  const map = new Map();

  dashboardFiltered.hasilGiling.forEach((item) => {
    const key = item.shift || '-';
    const old = map.get(key) || {
      shift: key,
      proses: 0,
      bersih: 0,
      kotor: 0,
      count: 0,
    };

    old.proses += Number(item.qty_proses_giling || 0);
    old.bersih += Number(item.qty_bersih || 0);
    old.kotor += Number(item.qty_kotor || 0);
    old.count += 1;
    map.set(key, old);
  });

  return [...map.values()].sort((a, b) => String(a.shift).localeCompare(String(b.shift)));
}, [dashboardFiltered.hasilGiling]);

const dashboardHasilByDay = useMemo(() => {
  const map = new Map();

  dashboardFiltered.hasilGiling.forEach((item) => {
    const key = item.tanggal || '-';
    const old = map.get(key) || {
      tanggal: key,
      proses: 0,
      bersih: 0,
      kotor: 0,
      count: 0,
    };

    old.proses += Number(item.qty_proses_giling || 0);
    old.bersih += Number(item.qty_bersih || 0);
    old.kotor += Number(item.qty_kotor || 0);
    old.count += 1;
    map.set(key, old);
  });

  return [...map.values()].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
}, [dashboardFiltered.hasilGiling]);

const dashboardAlerts = useMemo(() => {
  return dashboardFiltered.stokBubuk
    .map((item) => ({
      ...item,
      expiredStatus: getExpiredStatus(item.expired_date),
    }))
    .filter((item) => ['expired', '1bulan', '3bulan'].includes(item.expiredStatus.level))
    .sort((a, b) => {
      const da = a.expiredStatus.days ?? 99999;
      const db = b.expiredStatus.days ?? 99999;
      return da - db;
    });
}, [dashboardFiltered.stokBubuk]);

const dashboardAgingRows = useMemo(() => {
  return dashboardFiltered.stokBubuk
    .map((item) => ({
      ...item,
      lifetime: getBatchLifetimeInfo(item),
      expiredStatus: getExpiredStatus(item.expired_date),
    }))
    .sort((a, b) => b.lifetime.ageDays - a.lifetime.ageDays);
}, [dashboardFiltered.stokBubuk]);

const dashboardAgingAlerts = useMemo(() => {
  return dashboardAgingRows
    .filter((item) => ['slow', 'verySlow', 'watch'].includes(item.lifetime.movementLevel))
    .sort((a, b) => {
      const levelRank = { verySlow: 0, slow: 1, watch: 2, normal: 3, fast: 4 };
      const ar = levelRank[a.lifetime.movementLevel] ?? 9;
      const br = levelRank[b.lifetime.movementLevel] ?? 9;
      if (ar !== br) return ar - br;
      return b.lifetime.ageDays - a.lifetime.ageDays;
    });
}, [dashboardAgingRows]);

const dashboardAllAlerts = useMemo(() => {
  const expiredItems = dashboardAlerts.map((item) => ({ ...item, alertType: 'expired' }));
  const agingItems = dashboardAgingAlerts.map((item) => ({ ...item, alertType: 'aging' }));
  return [...expiredItems, ...agingItems];
}, [dashboardAlerts, dashboardAgingAlerts]);

const dashboardAgingDistribution = useMemo(() => {
  const base = [
    { name: 'Fast', qty: 0 },
    { name: 'Normal', qty: 0 },
    { name: 'Watchlist', qty: 0 },
    { name: 'Slow', qty: 0 },
    { name: 'Very Slow', qty: 0 },
  ];
  const map = new Map(base.map((item) => [item.name, item]));

  dashboardAgingRows.forEach((item) => {
    const level = item.lifetime.movementLevel;
    const key = level === 'verySlow' ? 'Very Slow' : level === 'slow' ? 'Slow' : level === 'watch' ? 'Watchlist' : level === 'normal' ? 'Normal' : 'Fast';
    const old = map.get(key) || { name: key, qty: 0 };
    old.qty += Number(item.sisa_bubuk_bersih || 0);
    map.set(key, old);
  });

  return [...map.values()];
}, [dashboardAgingRows]);

const dashboardTopWasteSource = useMemo(() => {
  const map = new Map();

  dashboardFiltered.wasteMasuk.forEach((item) => {
    const area = item.area_asal || '-';
    const shift = item.shift || '-';
    const lineValue = item.line || '-';
    const plant = item.plant_asal || item.plant || '-';
    const key = `${area}||${shift}||${lineValue}||${plant}`;
    const old = map.get(key) || {
      key,
      area,
      shift,
      line: lineValue,
      plant,
      name: `${area} • ${shift} • Line ${lineValue}`,
      qty: 0,
      count: 0,
      details: [],
    };

    old.qty += Number(item.qty_masuk || 0);
    old.count += 1;
    old.details.push(item);
    map.set(key, old);
  });

  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
}, [dashboardFiltered.wasteMasuk]);

const dashboardTopWasteSourceMax = useMemo(() => {
  return Math.max(1, ...dashboardTopWasteSource.map((item) => item.qty || 0));
}, [dashboardTopWasteSource]);

const dashboardShiftReport = useMemo(() => {
  const shiftMap = new Map();

  function ensureShift(shiftValue) {
    const shift = normalizeReportShift(shiftValue);

    if (!shiftMap.has(shift)) {
      shiftMap.set(shift, {
        shift,
        wasteRows: [],
        wasteTotalKg: 0,
        wasteCount: 0,
        hasilRows: [],
        progressRows: [],
        hasilWasteKg: 0,
        hasilBubukKg: 0,
        progressKg: 0,
        bonanRows: [],
        bonanKg: 0,
        bonanPcs: 0,
      });
    }

    return shiftMap.get(shift);
  }

  REPORT_SHIFT_ORDER.forEach((shift) => ensureShift(shift));

  const wasteMap = new Map();
  dashboardFiltered.wasteMasuk.forEach((item) => {
    const shift = normalizeReportShift(item.shift);
    const area = normalizeReportArea(item.area_asal);
    const plant = normalizeReportPlant(item.plant_asal || item.plant);
    const bucket = REPORT_SOURCE_BUCKETS.find((source) => source.area === area && source.plant === plant);

    if (!bucket) return;

    const nama = item.nama_waste || '-';
    const kode = item.kode_waste || '';
    const key = `${shift}||${bucket.key}||${kode}||${nama}`;
    const old = wasteMap.get(key) || {
      shift,
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      kode,
      nama,
      qtyKg: 0,
      count: 0,
    };

    old.qtyKg += Number(item.qty_masuk || 0);
    old.count += 1;
    wasteMap.set(key, old);

    const shiftData = ensureShift(shift);
    shiftData.wasteTotalKg += Number(item.qty_masuk || 0);
    shiftData.wasteCount += 1;
  });

  wasteMap.forEach((row) => {
    ensureShift(row.shift).wasteRows.push(row);
  });

  const hasilMap = new Map();
  dashboardFiltered.hasilGiling.forEach((item) => {
    const shift = normalizeReportShift(item.shift);
    const nama = item.nama_bubuk || item.nama_waste || '-';
    const kode = item.kode_bubuk || item.kode_waste || '';
    const key = `${shift}||${kode}||${nama}`;
    const old = hasilMap.get(key) || {
      shift,
      kode,
      nama,
      wasteKg: 0,
      bubukKg: 0,
      kotorKg: 0,
      count: 0,
    };

    old.wasteKg += Number(item.qty_proses_giling || 0);
    old.bubukKg += Number(item.qty_bersih || 0);
    old.kotorKg += Number(item.qty_kotor || 0);
    old.count += 1;
    hasilMap.set(key, old);

    const shiftData = ensureShift(shift);
    shiftData.hasilWasteKg += Number(item.qty_proses_giling || 0);
    shiftData.hasilBubukKg += Number(item.qty_bersih || 0);
  });

  hasilMap.forEach((row) => {
    ensureShift(row.shift).hasilRows.push(row);
  });

  const progressMap = new Map();
  dashboardFiltered.prosesGiling.forEach((item) => {
    const progressKg = Number(item.sisa_proses_giling || 0);
    if (progressKg <= 0) return;

    const shift = normalizeReportShift(item.shift);
    const nama = item.nama_waste || '-';
    const kode = item.kode_waste || '';
    const key = `${shift}||${kode}||${nama}`;
    const old = progressMap.get(key) || {
      shift,
      kode,
      nama,
      progressKg: 0,
      count: 0,
    };

    old.progressKg += progressKg;
    old.count += 1;
    progressMap.set(key, old);

    ensureShift(shift).progressKg += progressKg;
  });

  progressMap.forEach((row) => {
    ensureShift(row.shift).progressRows.push(row);
  });

  const bonanMap = new Map();
  dashboardFiltered.pengiriman.forEach((item) => {
    const shift = normalizeReportShift(item.shift);
    const nama = item.nama_bubuk || '-';
    const kode = item.kode_bubuk || '';
    const key = `${shift}||${kode}||${nama}`;
    const old = bonanMap.get(key) || {
      shift,
      kode,
      nama,
      qtyPcs: 0,
      qtyKg: 0,
      count: 0,
    };

    old.qtyPcs += Number(item.qty_pcs_kirim || 0);
    old.qtyKg += Number(item.qty_kirim || 0);
    old.count += 1;
    bonanMap.set(key, old);

    const shiftData = ensureShift(shift);
    shiftData.bonanKg += Number(item.qty_kirim || 0);
    shiftData.bonanPcs += Number(item.qty_pcs_kirim || 0);
  });

  bonanMap.forEach((row) => {
    ensureShift(row.shift).bonanRows.push(row);
  });

  const shifts = [...shiftMap.values()]
    .sort((a, b) => getShiftRank(a.shift) - getShiftRank(b.shift))
    .map((item) => ({
      ...item,
      wasteRows: item.wasteRows.sort((a, b) => getShiftRank(a.shift) - getShiftRank(b.shift) || String(a.bucketLabel).localeCompare(String(b.bucketLabel)) || b.qtyKg - a.qtyKg),
      hasilRows: item.hasilRows.sort((a, b) => b.bubukKg - a.bubukKg),
      progressRows: item.progressRows.sort((a, b) => b.progressKg - a.progressKg),
      bonanRows: item.bonanRows.sort((a, b) => b.qtyKg - a.qtyKg),
    }));

  const totals = shifts.reduce(
    (sum, item) => {
      sum.wasteKg += Number(item.wasteTotalKg || 0);
      sum.wasteCount += Number(item.wasteCount || 0);
      sum.hasilWasteKg += Number(item.hasilWasteKg || 0);
      sum.hasilBubukKg += Number(item.hasilBubukKg || 0);
      sum.progressKg += Number(item.progressKg || 0);
      sum.bonanKg += Number(item.bonanKg || 0);
      sum.bonanPcs += Number(item.bonanPcs || 0);
      return sum;
    },
    { wasteKg: 0, wasteCount: 0, hasilWasteKg: 0, hasilBubukKg: 0, progressKg: 0, bonanKg: 0, bonanPcs: 0 }
  );

  return { shifts, totals };
}, [dashboardFiltered]);

const dashboardYieldAnomalies = useMemo(() => {
  return dashboardFiltered.hasilGiling
    .map((item) => ({ ...item, yieldValue: getYieldValue(item) }))
    .filter((item) => Number(item.qty_proses_giling || 0) > 0 && item.yieldValue < 70)
    .sort((a, b) => a.yieldValue - b.yieldValue)
    .slice(0, 10);
}, [dashboardFiltered.hasilGiling]);

const dashboardTopLoss = useMemo(() => {
  return dashboardFiltered.hasilGiling
    .map((item) => ({ ...item, yieldValue: getYieldValue(item) }))
    .sort((a, b) => Number(b.qty_kotor || 0) - Number(a.qty_kotor || 0))
    .slice(0, 10);
}, [dashboardFiltered.hasilGiling]);


const maxTrendValue = useMemo(() => {
  const max = Math.max(
    1,
    ...dashboardTrend.map((item) =>
      Math.max(item.wasteMasuk || 0, item.hasilBersih || 0, item.wasteKotor || 0, item.pengiriman || 0)
    )
  );
  return max;
}, [dashboardTrend]);

const maxTopWasteValue = useMemo(() => {
  const max = Math.max(1, ...dashboardTopWasteMasuk.map((item) => item.qty || 0));
  return max;
}, [dashboardTopWasteMasuk]);

const dashboardFilteredSummary = useMemo(() => {
  const totalWasteGudang = dashboardFiltered.wasteGudang.reduce(
    (sum, item) => sum + Number(item.sisa_waste_gudang || 0),
    0
  );
  const totalProses = dashboardFiltered.prosesGiling.reduce(
    (sum, item) => sum + Number(item.sisa_proses_giling || 0),
    0
  );
  const totalBubukKg = dashboardFiltered.stokBubuk.reduce(
    (sum, item) => sum + Number(item.sisa_bubuk_bersih || 0),
    0
  );
  const totalBubukPcs = dashboardFiltered.stokBubuk.reduce(
    (sum, item) => sum + Number(item.sisa_pcs_bersih || 0),
    0
  );
  const totalHasilBersih = dashboardFiltered.hasilGiling.reduce(
    (sum, item) => sum + Number(item.qty_bersih || 0),
    0
  );
  const totalPengiriman = dashboardFiltered.pengiriman.reduce(
    (sum, item) => sum + Number(item.qty_kirim || 0),
    0
  );
  const totalKotor = Number(stokKotor?.sisa_waste_kotor || 0);
  const totalWasteStorage = totalWasteGudang + totalProses + totalKotor;
  const bubukUtilPct = WAREHOUSE_CAPACITY.bubukBersihKg > 0
    ? (totalBubukKg / WAREHOUSE_CAPACITY.bubukBersihKg) * 100
    : 0;
  const wasteUtilPct = WAREHOUSE_CAPACITY.wasteKg > 0
    ? (totalWasteStorage / WAREHOUSE_CAPACITY.wasteKg) * 100
    : 0;
  const avgDailyWasteMasuk = dashboardTrend.length > 0
    ? dashboardTrend.reduce((sum, item) => sum + Number(item.wasteMasuk || 0), 0) / dashboardTrend.length
    : 0;
  const wasteForecast = getCapacityForecast(totalWasteStorage, WAREHOUSE_CAPACITY.wasteKg, avgDailyWasteMasuk);

  return {
    totalWasteGudang,
    totalWasteGudangId: dashboardFiltered.wasteGudang.length,
    totalProses,
    totalProsesId: dashboardFiltered.prosesGiling.length,
    totalBubukKg,
    totalBubukPcs,
    totalBatch: dashboardFiltered.stokBubuk.length,
    totalHasilBersih,
    totalPengiriman,
    totalKotor,
    totalWasteStorage,
    bubukCapacityKg: WAREHOUSE_CAPACITY.bubukBersihKg,
    wasteCapacityKg: WAREHOUSE_CAPACITY.wasteKg,
    bubukUtilPct,
    wasteUtilPct,
    bubukUtilStatus: getUtilStatus(bubukUtilPct),
    wasteUtilStatus: getUtilStatus(wasteUtilPct),
    avgDailyWasteMasuk,
    wasteForecast,
    totalAlert: dashboardAllAlerts.length,
  };
}, [dashboardFiltered, dashboardTrend, dashboardAllAlerts.length, stokKotor]);

function quickSetDashboardPeriod(days) {
  setDashStartDate(addDaysYmd(days));
  setDashEndDate(todayYmd());
}

function handleExportDashboardPdf() {
  setDashTab('overview');
  setTimeout(() => window.print(), 250);
}

function handlePrintShiftReport() {
  setDashTab('laporan');
  setTimeout(() => window.print(), 250);
}

function handleExportShiftReportExcel() {
  const exportAt = `${formatDate(new Date())} ${formatTime(new Date())}`;
  const periodText = dashStartDate === dashEndDate ? dashStartDate : `${dashStartDate} s/d ${dashEndDate}`;
  const rows = [
    ['BSWP SHIFT REPORT'],
    ['Periode', periodText],
    ['Export', exportAt],
    ['Filter Plant', dashPlant],
    ['Filter Line', dashLine],
    [],
    ['RINGKASAN TOTAL'],
    ['Waste Masuk KG', dashboardShiftReport.totals.wasteKg],
    ['Waste Masuk Input', dashboardShiftReport.totals.wasteCount],
    ['Hasil Giling - Waste Proses KG', dashboardShiftReport.totals.hasilWasteKg],
    ['Hasil Giling - Bubuk Bersih KG', dashboardShiftReport.totals.hasilBubukKg],
    ['Masih Progress KG', dashboardShiftReport.totals.progressKg],
    ['Bonan PCS', dashboardShiftReport.totals.bonanPcs],
    ['Bonan KG', dashboardShiftReport.totals.bonanKg],
    [],
    ['WASTE MASUK PER SHIFT'],
  ];

  dashboardShiftReport.shifts.forEach((shift) => {
    rows.push([shift.shift]);
    rows.push(['Area / Plant', 'Nama Waste', 'Kode', 'KG', 'Jumlah Input']);
    shift.wasteRows.forEach((item) => {
      rows.push([item.bucketLabel, item.nama, item.kode, item.qtyKg, item.count]);
    });
    rows.push(['TOTAL', '', '', shift.wasteTotalKg, shift.wasteCount]);
    rows.push([]);
  });

  rows.push([]);
  rows.push(['HASIL GILING PER SHIFT']);
  dashboardShiftReport.shifts.forEach((shift) => {
    rows.push([shift.shift]);
    rows.push(['Nama Bubuk', 'Kode', 'Waste Proses KG', 'Hasil Bubuk KG', 'Waste Kotor KG', 'Jumlah Batch']);
    shift.hasilRows.forEach((item) => {
      rows.push([item.nama, item.kode, item.wasteKg, item.bubukKg, item.kotorKg, item.count]);
    });
    rows.push(['TOTAL', '', shift.hasilWasteKg, shift.hasilBubukKg, '', '']);
    rows.push(['MASIH PROGRESS']);
    rows.push(['Nama Waste', 'Kode', 'Progress KG', 'Jumlah ID']);
    shift.progressRows.forEach((item) => {
      rows.push([item.nama, item.kode, item.progressKg, item.count]);
    });
    rows.push(['TOTAL PROGRESS', '', shift.progressKg, '']);
    rows.push([]);
  });

  rows.push([]);
  rows.push(['BONAN PER SHIFT']);
  dashboardShiftReport.shifts.forEach((shift) => {
    rows.push([shift.shift]);
    rows.push(['Nama Bubuk', 'Kode', 'PCS', 'KG', 'Jumlah Bonan']);
    shift.bonanRows.forEach((item) => {
      rows.push([item.nama, item.kode, item.qtyPcs, item.qtyKg, item.count]);
    });
    rows.push(['TOTAL', '', shift.bonanPcs, shift.bonanKg, '']);
    rows.push([]);
  });

  const xml = `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      ${makeExcelWorksheet('Laporan Shift', rows)}
    </Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `BSWP_Laporan_Shift_${dashStartDate}_sd_${dashEndDate}.xls`);
}

function escapeExcelCell(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeExcelCell(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeExcelCell(value)}</Data></Cell>`;
}

function makeExcelWorksheet(name, rows) {
  const safeName = escapeExcelCell(String(name || 'Sheet').slice(0, 31));
  const body = rows
    .map((row) => `<Row>${row.map(makeExcelCell).join('')}</Row>`)
    .join('');

  return `
    <Worksheet ss:Name="${safeName}">
      <Table>${body}</Table>
    </Worksheet>
  `;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleExportStockOpnamePdf() {
  setOpnameTab('stok');
  setTimeout(() => window.print(), 300);
}

function handleExportStockOpnameExcel() {
  const exportAt = `${formatDate(new Date())} ${formatTime(new Date())}`;
  const filterText = `Jenis: ${opnameView} | Search: ${opnameSearch || '-'}`;

  const wasteTotalKg = stockOpnameData.wasteRows.reduce((sum, item) => sum + Number(item.qtyKg || 0), 0);
  const bubukTotalKg = stockOpnameData.bubukRows.reduce((sum, item) => sum + Number(item.qtyKg || 0), 0);
  const bubukTotalPcs = stockOpnameData.bubukRows.reduce((sum, item) => sum + Number(item.qtyPcs || 0), 0);
  const kotorTotalKg = stockOpnameData.kotorRows.reduce((sum, item) => sum + Number(item.qtyKg || 0), 0);

  const sheets = [
    {
      name: 'SUMMARY',
      rows: [
        ['BSWP STOCK OPNAME EXPORT'],
        ['Export At', exportAt],
        ['Filter', filterText],
        [],
        ['Metric', 'Value'],
        ['Total Item', stockOpnameData.totalItem],
        ['Waste + Proses KG', wasteTotalKg],
        ['Bubuk Bersih KG', bubukTotalKg],
        ['Bubuk Bersih PCS', bubukTotalPcs],
        ['Waste Kotor KG', kotorTotalKg || Number(stokKotor?.sisa_waste_kotor || 0)],
        ['Pending Adjustment', pendingAdjustments.length],
      ],
    },
    {
      name: 'OPNAME_WASTE',
      rows: [
        ['Sumber', 'ID / Ref', 'Kode Waste', 'Nama Waste', 'Asal', 'Stok Sistem KG', 'Keterangan'],
        ...stockOpnameData.wasteRows.map((item) => [
          item.source || '',
          item.id || '',
          item.kode || '',
          item.nama || '',
          item.asal || '',
          Number(item.qtyKg || 0),
          item.keterangan || '',
        ]),
        [],
        ['TOTAL', '', '', '', '', wasteTotalKg, ''],
      ],
    },
    {
      name: 'OPNAME_BUBUK',
      rows: [
        ['No Batch', 'Kode Bubuk', 'Nama Bubuk', 'Asal', 'Stok Sistem KG', 'Stok Sistem PCS', 'Keterangan'],
        ...stockOpnameData.bubukRows.map((item) => [
          item.id || '',
          item.kode || '',
          item.nama || '',
          item.asal || '',
          Number(item.qtyKg || 0),
          Number(item.qtyPcs || 0),
          item.keterangan || '',
        ]),
        [],
        ['TOTAL', '', '', '', bubukTotalKg, bubukTotalPcs, ''],
      ],
    },
    {
      name: 'OPNAME_KOTOR',
      rows: [
        ['Sumber', 'Kode Item', 'Nama Waste', 'Asal', 'Qty Total KG', 'Keterangan'],
        ...stockOpnameData.kotorRows.map((item) => [
          item.source || '',
          item.kode || '',
          item.nama || '',
          item.asal || '',
          Number(item.qtyKg || 0),
          item.keterangan || '',
        ]),
        [],
        ['TOTAL', '', '', '', kotorTotalKg, ''],
      ],
    },
    {
      name: 'PENDING_ADJ',
      rows: [
        [
          'Status',
          'Jenis',
          'Ref',
          'Kode',
          'Nama',
          'Asal',
          'Sistem KG',
          'Aktual KG',
          'Selisih KG',
          'Sistem PCS',
          'Aktual PCS',
          'Selisih PCS',
          'Note',
          'Created By',
          'Created At',
        ],
        ...pendingAdjustments.map((item) => [
          item.status || 'PENDING',
          getOpnameTypeLabel(item.stock_type),
          item.ref_id || '',
          item.kode_item || '',
          item.nama_item || '',
          item.asal || '',
          Number(item.stok_sistem_kg || 0),
          Number(item.stok_aktual_kg || 0),
          Number(item.selisih_kg || 0),
          Number(item.stok_sistem_pcs || 0),
          Number(item.stok_aktual_pcs || 0),
          Number(item.selisih_pcs || 0),
          item.note || '',
          item.created_by || '',
          item.created_at || '',
        ]),
      ],
    },
  ];

  const workbookXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
  </Styles>
  ${sheets.map((sheet) => makeExcelWorksheet(sheet.name, sheet.rows)).join('')}
</Workbook>`;

  const blob = new Blob([workbookXml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  downloadBlob(blob, `BSWP_Stock_Opname_${todayYmd()}.xls`);
}

const stockOpnameData = useMemo(() => {
  const keyword = toKeyText(opnameSearch);

  const wasteRows = [
    ...wasteGudang.map((item) => ({
      type: 'WASTE',
      source: 'Waste Gudang',
      id: item.id_waste_masuk,
      kode: item.kode_waste,
      nama: item.nama_waste,
      asal: `${item.plant_asal || '-'} • ${item.area_asal || '-'} • Line ${item.line || '-'}`,
      qtyKg: Number(item.sisa_waste_gudang || 0),
      qtyPcs: 0,
      keterangan: item.keterangan || item.no_pro_keterangan || '',
      raw: item,
    })),
    ...prosesGiling.map((item) => ({
      type: 'WASTE',
      source: 'Proses Giling',
      id: item.id_waste_masuk,
      kode: item.kode_waste,
      nama: item.nama_waste,
      asal: `${item.plant_asal || '-'} • ${item.area_asal || '-'} • Line ${item.line || '-'}`,
      qtyKg: Number(item.sisa_proses_giling || 0),
      qtyPcs: 0,
      keterangan: `Bubuk: ${item.nama_bubuk || '-'}${item.keterangan ? ` • ${item.keterangan}` : ''}`,
      raw: item,
    })),
  ];

  const bubukRows = stokBubuk.map((item) => ({
    type: 'BUBUK',
    source: 'Bubuk Bersih',
    id: item.no_batch_bubuk,
    kode: item.kode_bubuk,
    nama: item.nama_bubuk,
    asal: `${item.plant_asal || '-'} • ${item.area_asal || '-'} • Line ${item.line || '-'}`,
    qtyKg: Number(item.sisa_bubuk_bersih || 0),
    qtyPcs: Number(item.sisa_pcs_bersih || 0),
    keterangan: `Batch ${item.no_batch_bubuk || '-'} • Exp ${item.expired_date || '-'}`,
    raw: item,
  }));

  const kotorRows = rincianKotor.map((item, index) => ({
    type: 'KOTOR',
    source: item.kategori || 'Waste Kotor',
    id: `${item.kode_item || '-'}-${index}`,
    kode: item.kode_item,
    nama: item.nama_item,
    asal: item.sumber_kotor || '-',
    qtyKg: Number(item.total_kg || 0),
    qtyPcs: 0,
    keterangan: `${item.jumlah_transaksi || 0} transaksi`,
    raw: item,
  }));

  function match(row) {
    if (opnameView !== 'ALL' && row.type !== opnameView) return false;
    if (!keyword) return true;
    return toKeyText(`${row.kode} ${row.nama} ${row.asal} ${row.id} ${row.source} ${row.keterangan}`).includes(keyword);
  }

  function buildGroups(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const key = `${row.type}|${row.kode || '-'}|${row.nama || '-'}`;

      if (!map.has(key)) {
        map.set(key, {
          groupKey: key,
          type: row.type,
          kode: row.kode,
          nama: row.nama,
          qtyKg: 0,
          qtyPcs: 0,
          rowCount: 0,
          sourceSet: new Set(),
          asalSet: new Set(),
          rows: [],
        });
      }

      const group = map.get(key);
      group.qtyKg += Number(row.qtyKg || 0);
      group.qtyPcs += Number(row.qtyPcs || 0);
      group.rowCount += 1;
      group.sourceSet.add(row.source || '-');
      group.asalSet.add(row.asal || '-');
      group.rows.push(row);
    });

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        sourceLabel: Array.from(group.sourceSet).join(' + '),
        asalLabel: Array.from(group.asalSet).slice(0, 2).join(' • '),
      }))
      .sort((a, b) => b.qtyKg - a.qtyKg || String(a.nama || '').localeCompare(String(b.nama || '')));
  }

  const filteredWaste = wasteRows.filter(match);
  const filteredBubuk = bubukRows.filter(match);
  const filteredKotor = kotorRows.filter(match);

  const wasteGroups = buildGroups(filteredWaste);
  const bubukGroups = buildGroups(filteredBubuk);
  const kotorGroups = buildGroups(filteredKotor);

  return {
    wasteRows: filteredWaste,
    bubukRows: filteredBubuk,
    kotorRows: filteredKotor,
    wasteGroups,
    bubukGroups,
    kotorGroups,
    totalWasteKg: filteredWaste.reduce((sum, item) => sum + item.qtyKg, 0),
    totalBubukKg: filteredBubuk.reduce((sum, item) => sum + item.qtyKg, 0),
    totalBubukPcs: filteredBubuk.reduce((sum, item) => sum + Number(item.qtyPcs || 0), 0),
    totalKotorKg: filteredKotor.reduce((sum, item) => sum + item.qtyKg, 0),
    totalItem: filteredWaste.length + filteredBubuk.length + filteredKotor.length,
    totalJenis: wasteGroups.length + bubukGroups.length + kotorGroups.length,
  };
}, [wasteGudang, prosesGiling, stokBubuk, rincianKotor, opnameSearch, opnameView]);

function getOpnameStockType(item) {
  if (!item) return 'WASTE_GUDANG';
  if (item.type === 'BUBUK') return 'BUBUK_BERSIH';
  if (item.type === 'KOTOR') return 'WASTE_KOTOR';
  if (item.source === 'Proses Giling') return 'PROSES_GILING';
  return 'WASTE_GUDANG';
}

function getOpnameTypeLabel(type) {
  const map = {
    WASTE_GUDANG: 'Waste Gudang',
    PROSES_GILING: 'Proses Giling',
    BUBUK_BERSIH: 'Bubuk Bersih',
    WASTE_KOTOR: 'Waste Kotor',
  };

  return map[type] || type || '-';
}

function selectOpnameGroup(group) {
  setSelectedOpnameGroup(group);
  setNotif(null);
}

function closeOpnameGroup() {
  setSelectedOpnameGroup(null);
}

function getOpnameCandidateRows() {
  const rows = [
    ...stockOpnameData.wasteRows.map((item) => ({
      ...item,
      stockType: getOpnameStockType(item),
    })),
    ...stockOpnameData.bubukRows.map((item) => ({
      ...item,
      stockType: getOpnameStockType(item),
    })),
    ...stockOpnameData.kotorRows.map((item) => ({
      ...item,
      stockType: getOpnameStockType(item),
    })),
  ];

  return rows;
}

function selectOpnameItem(item) {
  const stockType = getOpnameStockType(item);

  setSelectedOpnameItem({
    ...item,
    stockType,
  });
  setSelectedOpnameGroup(null);

  setOpnameActualKg(item?.qtyKg ? String(item.qtyKg) : '');
  setOpnameActualPcs(item?.qtyPcs ? String(item.qtyPcs) : '');
  setOpnameNote('');
  setOpnameTab('input');
  setNotif(null);
}

function resetOpnameInput() {
  setSelectedOpnameItem(null);
  setOpnameActualKg('');
  setOpnameActualPcs('');
  setOpnameNote('');
}

async function submitStockOpname(e) {
  e.preventDefault();
  clearAllNotifs();

  if (!selectedOpnameItem) {
    setNotif({ type: 'error', message: 'Pilih item stok yang akan diopname dulu.' });
    return;
  }

  const actualKg = parseNumber(opnameActualKg);
  const actualPcs = opnameActualPcs === '' ? 0 : parseNumber(opnameActualPcs);

  if (Number.isNaN(actualKg) || actualKg < 0) {
    setNotif({ type: 'error', message: 'Stok aktual KG wajib diisi dan tidak boleh minus.' });
    return;
  }

  if (Number.isNaN(actualPcs) || actualPcs < 0) {
    setNotif({ type: 'error', message: 'Stok aktual PCS tidak boleh minus.' });
    return;
  }

  setSubmitting(true);

  const { data, error } = await supabase.rpc('submit_stock_opname', {
    p_stock_type: selectedOpnameItem.stockType,
    p_ref_id: selectedOpnameItem.id || '-',
    p_kode_item: selectedOpnameItem.kode || '',
    p_nama_item: selectedOpnameItem.nama || '',
    p_asal: selectedOpnameItem.asal || '',
    p_stok_sistem_kg: Number(selectedOpnameItem.qtyKg || 0),
    p_stok_sistem_pcs: Number(selectedOpnameItem.qtyPcs || 0),
    p_stok_aktual_kg: actualKg,
    p_stok_aktual_pcs: actualPcs,
    p_note: opnameNote || '',
    p_created_by: 'OPNAME-8888',
  });

  setSubmitting(false);

  if (error) {
    setNotif({ type: 'error', message: `Gagal simpan opname: ${error.message}` });
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;

  setNotif({
    type: result?.status === 'OK' ? 'success' : 'warning',
    message: result?.message || 'Stock opname berhasil disimpan.',
    detail: `Selisih KG: ${formatNumber(result?.selisih_kg)} • Selisih PCS: ${formatNumber(result?.selisih_pcs)} • Status: ${result?.status || '-'}`,
  });

  resetOpnameInput();
  await loadPendingAdjustments();
  setOpnameTab(result?.status === 'OK' ? 'stok' : 'pending');
}

async function loadPendingAdjustments() {
  setLoadingAdjustments(true);

  const { data, error } = await supabase
    .from('v_stock_opname_pending')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    setNotif({ type: 'error', message: `Gagal load pending adjustment: ${error.message}` });
    setPendingAdjustments([]);
    setLoadingAdjustments(false);
    return;
  }

  setPendingAdjustments(data || []);
  setLoadingAdjustments(false);
}

async function approveStockAdjustment(item) {
  const ok = window.confirm(`Approve koreksi stok ${item.nama_item || item.ref_id}?\n\nSelisih KG: ${formatNumber(item.selisih_kg)}\nSelisih PCS: ${formatNumber(item.selisih_pcs)}`);
  if (!ok) return;

  setSubmitting(true);

  const { data, error } = await supabase.rpc('approve_stock_opname_adjustment', {
    p_opname_id: item.id,
    p_approved_by: 'OPNAME-8888',
  });

  setSubmitting(false);

  if (error) {
    setNotif({ type: 'error', message: `Gagal approve adjustment: ${error.message}` });
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;

  setNotif({
    type: 'success',
    message: result?.message || 'Adjustment berhasil di-approve.',
    detail: 'Stok live Supabase sudah ikut terkoreksi lewat adjustment log.',
  });

  await Promise.all([refreshAll(), loadRincianKotor(), loadPendingAdjustments()]);
}

async function rejectStockAdjustment(item) {
  const reason = window.prompt('Alasan reject adjustment:', 'Salah input / perlu cek ulang');
  if (reason === null) return;

  setSubmitting(true);

  const { data, error } = await supabase.rpc('reject_stock_opname_adjustment', {
    p_opname_id: item.id,
    p_rejected_by: 'OPNAME-8888',
    p_reason: reason || '',
  });

  setSubmitting(false);

  if (error) {
    setNotif({ type: 'error', message: `Gagal reject adjustment: ${error.message}` });
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;

  setNotif({
    type: 'success',
    message: result?.message || 'Adjustment berhasil ditolak.',
  });

  await loadPendingAdjustments();
}




  async function toggleRincianKotor() {
    const next = !showRincianKotor;
    setShowRincianKotor(next);
    if (next && rincianKotor.length === 0) {
      await loadRincianKotor();
    }
  }


  if (page === 'masterAdminPin' && !masterAdminUnlocked) {
    return (
      <div className="lock-screen master-lock-screen">
        <div className="lock-glow lock-glow-a" />
        <div className="lock-glow lock-glow-b" />
        <div className="lock-glow lock-glow-c" />

        <div className="lock-topbar">
          <span>{APP_NAME}</span>
          <button
            type="button"
            className="theme-pill"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
          </button>
        </div>

        <div className="lock-center master-lock-center">
          <h1>Master Data Admin</h1>
          <p>Masukkan PIN area inti sistem</p>

          <div className="pin-dots">
            {[0, 1, 2, 3, 4].map((item) => (
              <span key={item} className={masterAdminPinDigits[item] ? 'filled' : ''} />
            ))}
          </div>

          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} type="button" className="keypad-btn" onClick={() => handleMasterAdminPinPress(String(num))}>
                {num}
              </button>
            ))}

            <button type="button" className="keypad-btn secondary" onClick={handleMasterAdminPinBackspace}>
              ⌫
            </button>
            <button type="button" className="keypad-btn" onClick={() => handleMasterAdminPinPress('0')}>
              0
            </button>
            <button
              type="button"
              className="keypad-btn secondary"
              onClick={() => {
                setMasterAdminPinDigits([]);
                setNotif(null);
              }}
            >
              C
            </button>
          </div>

          <small className="lock-hint">PIN khusus Master Data Admin</small>

          {notif && (
            <div className={`notif ${notif.type} lock-notif`}>
              <b>{notif.message}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (page === 'masterAdminConfirm' && !masterAdminUnlocked) {
    return (
      <div className="lock-screen master-confirm-screen">
        <div className="lock-glow lock-glow-a" />
        <div className="lock-glow lock-glow-b" />

        <div className="master-confirm-card">
          <span className="lux-kicker">KONFIRMASI AREA INTI</span>
          <h1>INI MERUPAKAN AREA INTI SISTEM.</h1>
          <p>APAKAH SUDAH IJIN UH/SH?!</p>

          <div className="master-confirm-warning">
            Perubahan di menu ini dapat mengubah dropdown, master waste, master bubuk, dan data referensi operasional.
          </div>

          <div className="master-confirm-actions">
            <button type="button" className="submit-btn" onClick={confirmMasterAdminAccess}>
              SUDAH IJIN UH/SH
            </button>
            <button type="button" className="ghost-btn danger wide" onClick={cancelMasterAdminAccess}>
              BATAL / BELUM IJIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'opnamePin' && !opnameUnlocked) {
    return (
      <div className="lock-screen opname-lock-screen">
        <div className="lock-glow lock-glow-a" />
        <div className="lock-glow lock-glow-b" />
        <div className="lock-glow lock-glow-c" />

        <div className="lock-topbar">
          <span>{APP_NAME}</span>
          <button
            type="button"
            className="theme-pill"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
          </button>
        </div>

        <div className="lock-center">
          <h1>Stock Opname</h1>
          <p>Masukkan PIN khusus opname</p>

          <div className="pin-dots">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={opnamePinDigits[item] ? 'filled' : ''} />
            ))}
          </div>

          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} type="button" className="keypad-btn" onClick={() => handleOpnamePinPress(String(num))}>
                {num}
              </button>
            ))}

            <button type="button" className="keypad-btn secondary" onClick={handleOpnamePinBackspace}>
              ⌫
            </button>
            <button type="button" className="keypad-btn" onClick={() => handleOpnamePinPress('0')}>
              0
            </button>
            <button
              type="button"
              className="keypad-btn secondary"
              onClick={() => {
                setOpnamePinDigits([]);
                setNotif(null);
              }}
            >
              C
            </button>
          </div>

          

          {notif && (
            <div className={`notif ${notif.type} lock-notif`}>
              <b>{notif.message}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (page === 'pinForm' && !isUnlocked) {
    return (
      <div className="lock-screen">
        <div className="lock-glow lock-glow-a" />
        <div className="lock-glow lock-glow-b" />
        <div className="lock-glow lock-glow-c" />

        <div className="lock-topbar">
          <span>{APP_NAME}</span>
          <button
            type="button"
            className="theme-pill"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
          </button>
        </div>

        <div className="lock-center">
          <h1>{APP_NAME}</h1>
          <p>Masukkan kata sandi</p>

          <div className="pin-dots">
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={pinDigits[item] ? 'filled' : ''} />
            ))}
          </div>

          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} type="button" className="keypad-btn" onClick={() => handlePinPress(String(num))}>
                {num}
              </button>
            ))}

            <button type="button" className="keypad-btn secondary" onClick={handlePinBackspace}>
              ⌫
            </button>
            <button type="button" className="keypad-btn" onClick={() => handlePinPress('0')}>
              0
            </button>
            <button
              type="button"
              className="keypad-btn secondary"
              onClick={() => {
                setPinDigits([]);
                setNotif(null);
              }}
            >
              C
            </button>
          </div>

          

          {notif && (
            <div className={`notif ${notif.type} lock-notif`}>
              <b>{notif.message}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>{APP_NAME}</h1>
          <p>{pageTitle(page)}</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? '☀️ Terang' : '🌙 Gelap'}
          </button>

          {page !== 'home' && (
  <button type="button" className="ghost-btn" onClick={() => setPage('home')}>
    Menu Awal
  </button>
)}

          <button type="button" className="ghost-btn" onClick={refreshAll}>
            Refresh
          </button>

          <button type="button" className="ghost-btn danger" onClick={lockApp}>
            Keluar
          </button>
        </div>
      </header>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`History - ${pageTitle(historyPage)}`}
        historyDate={historyDate}
        setHistoryDate={setHistoryDate}
        loading={historyLoading}
        rows={historyRows}
        page={historyPage}
      />

{historyWasteOpen && (
  <div className="drawer-backdrop" onClick={() => setHistoryWasteOpen(false)}>
    <div className="drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div>
          <h3>History Waste Masuk</h3>
          <p>Per Group ID / Kategori / No PRO</p>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setHistoryWasteOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="drawer-filter">
        <label>Tanggal</label>
        <input
          type="date"
          value={historyWasteDate}
          onChange={(e) => setHistoryWasteDate(e.target.value)}
        />
      </div>

      <div className="history-list">
        {loadingHistoryWaste && (
          <div className="empty-state">Loading history...</div>
        )}

        {!loadingHistoryWaste && historyWasteRows.length === 0 && (
          <div className="empty-state">Belum ada data di tanggal ini.</div>
        )}

        {!loadingHistoryWaste &&
          historyWasteRows.map((group) => {
            const details = Array.isArray(group.details) ? group.details : [];

            return (
              <div className="history-group-card" key={group.group_id}>
                <div className="history-group-head">
                  <div>
                    <b>{group.group_id}</b>
                    <span>
                      {group.kategori_waste} • {group.no_pro_keterangan}
                    </span>
                    <small>
                      {group.tanggal} • {group.jam_input || '-'} •{' '}
                      {group.shift || '-'} • {group.area_asal || '-'}
                    </small>
                  </div>

                  <strong>{formatNumber(group.total_qty)} KG</strong>
                </div>

                <div className="history-group-summary">
                  <span>{group.total_item} waste</span>
                  <span>Total {formatNumber(group.total_qty)} KG</span>
                </div>

                <div className="history-detail-list">
                  {details.map((item) => (
                    <div
                      className="history-detail-row"
                      key={item.id_waste_masuk}
                    >
                      <div>
                        <b>{item.nama_waste}</b>
                        <small>
                          ID: {item.id_waste_masuk} • Plant{' '}
                          {item.plant_asal || '-'} • Line {item.line || '-'} •{' '}
                          {item.tipe_waste || '-'}
                        </small>
                        {item.keterangan && <small>{item.keterangan}</small>}
                      </div>

                      <strong>{formatNumber(item.qty_masuk)} KG</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  </div>
)}


{wasteGudangDetail && (
  <div className="drawer-backdrop" onClick={() => setWasteGudangDetail(null)}>
    <div className="drawer source-detail-drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div>
          <h3>Detail Waste Gudang per Jenis</h3>
          <p>{wasteGudangDetail.nama} • {wasteGudangDetail.count} ID aktif</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => setWasteGudangDetail(null)}>
          ×
        </button>
      </div>

      <div className="source-detail-summary">
        <div>
          <span>Total Sisa Gudang</span>
          <b>{formatNumber(wasteGudangDetail.qty)} KG</b>
        </div>
        <div>
          <span>Jumlah ID</span>
          <b>{wasteGudangDetail.count}</b>
        </div>
      </div>

      <div className="history-list">
        {wasteGudangDetail.details.slice(0, 150).map((item, index) => (
          <div className="history-card" key={`${item.id_waste_masuk || index}-${index}`}>
            <b>{item.id_waste_masuk || '-'}</b>
            <span>{formatNumber(item.sisa_waste_gudang)} KG • {item.nama_waste || '-'}</span>
            <small>Plant {item.plant_asal || '-'} • Area {item.area_asal || '-'} • Line {item.line || '-'}</small>
            <small>{item.tanggal || '-'} • {item.jam_input || '-'} • {item.tipe_waste || '-'}</small>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{livePenerimaanDetail && (
  <div className="drawer-backdrop" onClick={() => setLivePenerimaanDetail(null)}>
    <div className="drawer source-detail-drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div>
          <h3>Detail Live Penerimaan</h3>
          <p>{livePenerimaanDetail.shift} • urutan scan/input waste masuk</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => setLivePenerimaanDetail(null)}>
          ×
        </button>
      </div>

      <div className="source-detail-summary">
        <div>
          <span>Total Penerimaan</span>
          <b>{formatNumber(livePenerimaanDetail.qty)} KG</b>
        </div>
        <div>
          <span>Jumlah Input</span>
          <b>{livePenerimaanDetail.count}</b>
        </div>
      </div>

      <div className="history-list">
        {livePenerimaanDetail.details.slice(0, 200).map((item, index) => (
          <div className="history-card" key={`${item.id || item.id_waste_masuk || index}-${index}`}>
            <b>{index + 1}. {item.nama_waste || '-'}</b>
            <span>{formatNumber(item.qty_masuk)} KG • {item.tipe_waste || '-'}</span>
            <small>{item.tanggal || '-'} • {item.jam_input || '-'} • ID {item.id_waste_masuk || '-'}</small>
            <small>Plant {item.plant_asal || '-'} • Area {item.area_asal || '-'} • Line {item.line || '-'}</small>
            <small>No PRO/Ket: {item.no_pro_keterangan || item.keterangan || '-'}</small>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{sourceDetail && (
  <div className="drawer-backdrop" onClick={() => setSourceDetail(null)}>
    <div className="drawer source-detail-drawer" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div>
          <h3>Detail Sumber Waste</h3>
          <p>{sourceDetail.area} • {sourceDetail.shift} • Line {sourceDetail.line} • Plant {sourceDetail.plant}</p>
        </div>
        <button type="button" className="icon-btn" onClick={() => setSourceDetail(null)}>
          ×
        </button>
      </div>

      <div className="source-detail-summary">
        <div>
          <span>Total Waste</span>
          <b>{formatNumber(sourceDetail.qty)} KG</b>
        </div>
        <div>
          <span>Jumlah Input</span>
          <b>{sourceDetail.count}</b>
        </div>
      </div>

      <div className="history-list">
        {[...sourceDetail.details]
          .sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')))
          .slice(0, 80)
          .map((item, index) => (
            <div className="history-card" key={`${item.id || item.id_waste_masuk || index}-${index}`}>
              <b>{item.nama_waste || '-'}</b>
              <span>{formatNumber(item.qty_masuk)} KG • {item.tipe_waste || '-'}</span>
              <small>{item.tanggal || '-'} • {item.shift || '-'} • {item.kategori_waste || '-'}</small>
              <small>No PRO/Ket: {item.no_pro_keterangan || '-'}</small>
              <small>ID: {item.id_waste_masuk || '-'}</small>
            </div>
          ))}
      </div>
    </div>
  </div>
)}

      {page === 'home' && (
  <main className="page-card">
    <div className="hero-card">
      <div>
        <h2>{APP_NAME}</h2>
        <p>Dashboard live dan form penginputan waste dalam satu aplikasi.</p>
      </div>

      <div className="hero-stats">
        <div className="stat-box">
          <span>Tanggal</span>
          <b>{formatDate(clock)}</b>
        </div>
        <div className="stat-box">
          <span>Jam</span>
          <b>{formatTime(clock)}</b>
        </div>
        <div className="stat-box">
          <span>Shift</span>
          <b>{getShiftByDate(clock)}</b>
        </div>
      </div>
    </div>

    <div className="menu-grid home-menu-grid">
      <button className="menu-card dashboard-menu-card" onClick={() => setPage('dashboard')}>
        <b>📊</b>
        <span>Dashboard BSWP</span>
        <small>Lihat stok live dari HP, laptop, dan TV monitor</small>
      </button>

      <button className="menu-card report-menu-card" onClick={() => {
        setPage('dashboard');
        setDashTab('laporan');
      }}>
        <b>📄</b>
        <span>Laporan Shift</span>
        <small>Ringkasan 1 halaman untuk screenshot WA + export Excel</small>
      </button>

      <button className="menu-card input-menu-card" onClick={openFormMenu}>
        <b>🔐</b>
        <span>Form Penginputan</span>
        <small>Masuk PIN untuk input waste, giling, hasil, kirim, dan kotor</small>
      </button>

      <button className="menu-card opname-menu-card" onClick={openStockOpname}>
        <b>📦</b>
        <span>Stock Opname</span>
        <small>Cek stok bubuk, waste, dan waste kotor real time</small>
      </button>

      <button className="menu-card master-menu-card" onClick={openMasterDataAdmin}>
        <b>🧬</b>
        <span>Master Data Admin</span>
        <small>Area inti sistem. PIN 14045 + konfirmasi ijin UH/SH.</small>
      </button>
    </div>
  </main>
)}

{page === 'formMenu' && (
  <main className="page-card">
    <div className="hero-card">
      <div>
        <h2>Form Penginputan</h2>
        <p>Pilih proses input BSWP.</p>
      </div>

      <div className="hero-stats">
        <div className="stat-box">
          <span>Tanggal</span>
          <b>{formatDate(clock)}</b>
        </div>
        <div className="stat-box">
          <span>Jam</span>
          <b>{formatTime(clock)}</b>
        </div>
        <div className="stat-box">
          <span>Shift</span>
          <b>{getShiftByDate(clock)}</b>
        </div>
      </div>
    </div>

    <div className="menu-grid">
      <button className="menu-card" onClick={() => setPage('wasteMasuk')}>
        <b>1</b>
        <span>Input Waste Masuk</span>
        <small>Waste masuk gudang / langsung kotor</small>
      </button>

      <button className="menu-card" onClick={() => setPage('prosesGiling')}>
        <b>2</b>
        <span>Input Proses Giling</span>
        <small>Pindah waste gudang ke proses giling</small>
      </button>

      <button className="menu-card" onClick={() => setPage('hasilGiling')}>
        <b>3</b>
        <span>Input Hasil Giling</span>
        <small>Buat batch bubuk bersih dan kotor otomatis</small>
      </button>

      <button className="menu-card" onClick={() => setPage('pengirimanBersih')}>
        <b>4</b>
        <span>Pengiriman Bubuk Bersih</span>
        <small>Kirim ke Produksi 1112 / 1113 / lainnya</small>
      </button>

      <button className="menu-card" onClick={() => setPage('pengeluaranKotor')}>
        <b>5</b>
        <span>Pengeluaran Waste Kotor</span>
        <small>Jual / buang / adjustment</small>
      </button>
    </div>
  </main>
)}



{page === 'masterData' && (
  <main className="page-card master-data-page">
    <div className="hero-card master-data-hero">
      <div>
        <span className="lux-kicker">CORE SYSTEM</span>
        <h2>Master Data Admin</h2>
        <p>
          Area inti sistem untuk mengatur master supplier, waste, dan bubuk. Gunakan hanya setelah ijin UH/SH.
        </p>
      </div>

      <div className="hero-stats">
        <div className="stat-box">
          <span>Supplier Aktif</span>
          <b>{masterSupplierRows.filter((item) => item.is_active !== false).length}</b>
        </div>
        <div className="stat-box">
          <span>Master Waste</span>
          <b>{masterWasteAdminRows.length}</b>
        </div>
        <div className="stat-box">
          <span>Akses</span>
          <b>14045</b>
        </div>
      </div>
    </div>

    <div className="master-danger-banner">
      <b>⚠️ AREA INTI SISTEM</b>
      <span>Perubahan di sini langsung mempengaruhi pilihan input/dropdown dan operasional BSWP.</span>
    </div>

    <div className="dashboard-tabs master-tabs">
      {[
        ['supplier', 'Master Supplier'],
        ['waste', 'Master Waste/Bubuk'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={masterTab === value ? 'active' : ''}
          onClick={() => setMasterTab(value)}
        >
          {label}
        </button>
      ))}
    </div>

    {masterTab === 'supplier' && (
      <div className="master-grid">
        <section className="dashboard-section master-form-section">
          <div className="dashboard-section-head">
            <div>
              <h3>{masterSupplierForm.id ? 'Edit Supplier' : 'Tambah Supplier'}</h3>
              <span>Dropdown pengeluaran / pemusnahan waste kotor</span>
            </div>
            {masterSupplierForm.id && (
              <button type="button" className="mini-btn" onClick={resetMasterSupplierForm}>
                Batal Edit
              </button>
            )}
          </div>

          <form className="form-wrap compact-form" onSubmit={saveMasterSupplier}>
            <label>Nama Supplier</label>
            <input
              value={masterSupplierForm.nama_supplier}
              onChange={(e) => setMasterSupplierForm((prev) => ({ ...prev, nama_supplier: e.target.value }))}
              placeholder="Contoh: HERI"
            />

            <label>Jenis</label>
            <select
              value={masterSupplierForm.jenis}
              onChange={(e) => setMasterSupplierForm((prev) => ({ ...prev, jenis: e.target.value }))}
            >
              <option value="JUAL">JUAL</option>
              <option value="MUSNAH">MUSNAH</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="LAINNYA">LAINNYA</option>
            </select>

            <label>Urutan</label>
            <input
              value={masterSupplierForm.sort_order}
              onChange={(e) => setMasterSupplierForm((prev) => ({ ...prev, sort_order: e.target.value }))}
              inputMode="numeric"
              placeholder="10"
            />

            <label>Keterangan</label>
            <textarea
              value={masterSupplierForm.keterangan}
              onChange={(e) => setMasterSupplierForm((prev) => ({ ...prev, keterangan: e.target.value }))}
              placeholder="Opsional"
            />

            <label className="check-row">
              <input
                type="checkbox"
                checked={masterSupplierForm.is_active}
                onChange={(e) => setMasterSupplierForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              Aktif di dropdown
            </label>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : masterSupplierForm.id ? 'Update Supplier' : 'Simpan Supplier'}
            </button>
          </form>
        </section>

        <section className="dashboard-section master-list-section">
          <div className="dashboard-section-head">
            <div>
              <h3>Data Supplier</h3>
              <span>{loadingMasterSupplier ? 'Loading...' : `${masterSupplierRows.length} supplier`}</span>
            </div>
            <button type="button" className="mini-btn" onClick={loadMasterSupplierKotor}>
              Refresh
            </button>
          </div>

          <div className="master-list">
            {masterSupplierRows.map((item) => (
              <div className={`master-row ${item.is_active === false ? 'inactive' : ''}`} key={item.id || item.nama_supplier}>
                <div>
                  <b>{item.nama_supplier}</b>
                  <small>{item.jenis || '-'} • Urutan {item.sort_order ?? '-'}</small>
                  {item.keterangan && <small>{item.keterangan}</small>}
                </div>
                <div className="master-row-actions">
                  <span className={`status-pill ${item.is_active === false ? 'danger' : 'success'}`}>
                    {item.is_active === false ? 'Nonaktif' : 'Aktif'}
                  </span>
                  <button type="button" className="mini-btn" onClick={() => editMasterSupplier(item)}>
                    Edit
                  </button>
                  <button type="button" className="mini-btn danger" onClick={() => toggleMasterSupplierActive(item)}>
                    {item.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
                  </button>
                </div>
              </div>
            ))}

            {!loadingMasterSupplier && masterSupplierRows.length === 0 && (
              <div className="empty-state">Belum ada master supplier. Jalankan SQL Master Data Admin dulu.</div>
            )}
          </div>
        </section>
      </div>
    )}

    {masterTab === 'waste' && (
      <div className="master-grid">
        <section className="dashboard-section master-form-section">
          <div className="dashboard-section-head">
            <div>
              <h3>{masterWasteForm.id ? 'Edit Waste/Bubuk' : 'Tambah Waste/Bubuk'}</h3>
              <span>Master ini dipakai di input waste dan mapping hasil giling</span>
            </div>
            {masterWasteForm.id && (
              <button type="button" className="mini-btn" onClick={resetMasterWasteForm}>
                Batal Edit
              </button>
            )}
          </div>

          <form className="form-wrap compact-form" onSubmit={saveMasterWasteAdmin}>
            <label>Kode Waste</label>
            <input
              value={masterWasteForm.kode_waste}
              onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, kode_waste: e.target.value }))}
              placeholder="Contoh: 4331010053"
            />

            <label>Nama Waste</label>
            <input
              value={masterWasteForm.nama_waste}
              onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, nama_waste: e.target.value }))}
              placeholder="Nama waste"
            />

            <label>Tipe Waste</label>
            <select
              value={masterWasteForm.tipe_waste}
              onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, tipe_waste: e.target.value }))}
            >
              <option value="GILING">GILING / RECYCLE</option>
              <option value="KOTOR">KOTOR</option>
            </select>

            <label>Kode Bubuk</label>
            <input
              value={masterWasteForm.kode_bubuk}
              onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, kode_bubuk: e.target.value }))}
              placeholder="Isi kalau tipe GILING"
            />

            <label>Nama Bubuk</label>
            <input
              value={masterWasteForm.nama_bubuk}
              onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, nama_bubuk: e.target.value }))}
              placeholder="Isi kalau tipe GILING"
            />

            <div className="inline-grid-3">
              <div>
                <label>Plant</label>
                <input
                  value={masterWasteForm.plant}
                  onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, plant: e.target.value }))}
                  placeholder="1112"
                />
              </div>
              <div>
                <label>Line</label>
                <input
                  value={masterWasteForm.line}
                  onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, line: e.target.value }))}
                  placeholder="1.1"
                />
              </div>
              <div>
                <label>Yield %</label>
                <input
                  value={masterWasteForm.yield_bersih}
                  onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, yield_bersih: e.target.value }))}
                  inputMode="decimal"
                  placeholder="98"
                />
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={masterWasteForm.is_active}
                onChange={(e) => setMasterWasteForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              Aktif di input
            </label>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : masterWasteForm.id ? 'Update Waste/Bubuk' : 'Simpan Waste/Bubuk'}
            </button>
          </form>
        </section>

        <section className="dashboard-section master-list-section">
          <div className="dashboard-section-head">
            <div>
              <h3>Data Waste/Bubuk</h3>
              <span>{loadingMasterAdminWaste ? 'Loading...' : `${masterWasteAdminRows.length} item`}</span>
            </div>
            <button type="button" className="mini-btn" onClick={loadMasterWasteAdmin}>
              Refresh
            </button>
          </div>

          <div className="master-list">
            {masterWasteAdminRows.map((item) => (
              <div className={`master-row ${item.is_active === false ? 'inactive' : ''}`} key={item.id || `${item.kode_waste}-${item.nama_waste}`}>
                <div>
                  <b>{item.kode_waste} • {item.nama_waste}</b>
                  <small>
                    Tipe {item.tipe_waste || '-'} • Plant {item.plant || '-'} • Line {item.line || '-'} • Yield {formatNumber(item.yield_bersih)}%
                  </small>
                  <small>
                    Bubuk: {item.kode_bubuk || '-'} • {item.nama_bubuk || '-'}
                  </small>
                </div>
                <div className="master-row-actions">
                  <span className={`status-pill ${item.is_active === false ? 'danger' : 'success'}`}>
                    {item.is_active === false ? 'Nonaktif' : 'Aktif'}
                  </span>
                  <button type="button" className="mini-btn" onClick={() => editMasterWaste(item)}>
                    Edit
                  </button>
                  <button type="button" className="mini-btn danger" onClick={() => toggleMasterWasteActive(item)}>
                    {item.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
                  </button>
                </div>
              </div>
            ))}

            {!loadingMasterAdminWaste && masterWasteAdminRows.length === 0 && (
              <div className="empty-state">Belum ada master waste/bubuk.</div>
            )}
          </div>
        </section>
      </div>
    )}

    <div className="bottom-actions">
      <button type="button" className="ghost-btn" onClick={() => setPage('home')}>
        Menu Awal
      </button>
      <button type="button" className="ghost-btn danger" onClick={lockMasterDataAdmin}>
        Kunci Master Data
      </button>
    </div>
  </main>
)}

{page === 'stockOpname' && (
  <main className="page-card stock-opname-page">
    <div className="hero-card opname-hero-card">
      <div>
        <span className="lux-kicker">OPNAME CONTROL</span>
        <h2>Stock Opname</h2>
        <p>
          Cek stok fisik, input aktual, lalu koreksi stok masuk Pending Adjustment sebelum mengubah stok live.
        </p>
      </div>

      <div className="hero-stats">
        <div className="stat-box">
          <span>Total Jenis</span>
          <b>{stockOpnameData.totalJenis}</b>
        </div>
        <div className="stat-box">
          <span>Pending</span>
          <b>{pendingAdjustments.length}</b>
        </div>
        <div className="stat-box">
          <span>Shift</span>
          <b>{getShiftByDate(clock)}</b>
        </div>
      </div>
    </div>

    <div className="opname-tabs">
      {[
        ['stok', 'Stok Sistem'],
        ['input', 'Input Opname'],
        ['pending', `Pending Adjustment (${pendingAdjustments.length})`],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={opnameTab === key ? 'active' : ''}
          onClick={() => {
            setOpnameTab(key);
            if (key === 'pending') loadPendingAdjustments();
          }}
        >
          {label}
        </button>
      ))}
    </div>

    <div className="opname-summary-grid">
      <div className="dash-card green">
        <span>Waste + Proses</span>
        <b>{formatNumber(stockOpnameData.totalWasteKg)} KG</b>
        <small>{stockOpnameData.wasteGroups.length} jenis • {stockOpnameData.wasteRows.length} rincian</small>
      </div>
      <div className="dash-card purple">
        <span>Bubuk Bersih</span>
        <b>{formatNumber(stockOpnameData.totalBubukKg)} KG</b>
        <small>{formatNumber(stockOpnameData.totalBubukPcs)} PCS • {stockOpnameData.bubukGroups.length} jenis • {stockOpnameData.bubukRows.length} batch</small>
      </div>
      <div className="dash-card danger">
        <span>Waste Kotor</span>
        <b>{formatNumber(stockOpnameData.totalKotorKg || stokKotor?.sisa_waste_kotor)} KG</b>
        <small>{stockOpnameData.kotorGroups.length} jenis • {stockOpnameData.kotorRows.length} rincian</small>
      </div>
    </div>

    <div className="dashboard-toolbar opname-toolbar">
      <div className="filter-grid opname-filter-grid">
        <div>
          <label>Jenis Opname</label>
          <select value={opnameView} onChange={(e) => setOpnameView(e.target.value)}>
            <option value="ALL">Semua</option>
            <option value="WASTE">Waste + Proses Giling</option>
            <option value="BUBUK">Bubuk Bersih</option>
            <option value="KOTOR">Waste Kotor</option>
          </select>
        </div>
        <div className="filter-search">
          <label>Search</label>
          <input
            value={opnameSearch}
            onChange={(e) => setOpnameSearch(e.target.value)}
            placeholder="Cari kode, nama, batch, line, asal..."
          />
        </div>
        <div className="opname-action-stack">
          <button
            type="button"
            className="ghost-btn wide"
            onClick={() => {
              refreshAll();
              loadRincianKotor();
              if (opnameTab === 'pending') loadPendingAdjustments();
            }}
          >
            Refresh Stok
          </button>
          <div className="opname-export-actions">
            <button type="button" className="ghost-btn wide opname-export-pdf" onClick={handleExportStockOpnamePdf}>
              Export PDF
            </button>
            <button type="button" className="ghost-btn wide opname-export-excel" onClick={handleExportStockOpnameExcel}>
              Export Excel
            </button>
          </div>
          <button type="button" className="ghost-btn danger wide" onClick={lockStockOpname}>
            Kunci Opname
          </button>
        </div>
      </div>
    </div>

    {opnameTab === 'stok' && (
      <>
        {selectedOpnameGroup && (
          <section className="dashboard-section opname-section opname-detail-section">
            <div className="dashboard-section-head opname-detail-head">
              <div>
                <h3>Rincian {selectedOpnameGroup.nama || '-'}</h3>
                <span>
                  {selectedOpnameGroup.kode || '-'} • {selectedOpnameGroup.rowCount} rincian • {formatNumber(selectedOpnameGroup.qtyKg)} KG
                  {selectedOpnameGroup.qtyPcs ? ` / ${formatNumber(selectedOpnameGroup.qtyPcs)} PCS` : ''}
                </span>
              </div>
              <button type="button" className="ghost-btn wide" onClick={closeOpnameGroup}>
                Tutup Rincian
              </button>
            </div>

            <div className="opname-group-summary-card">
              <div>
                <span>Total Sistem</span>
                <b>{formatNumber(selectedOpnameGroup.qtyKg)} KG</b>
                {selectedOpnameGroup.qtyPcs ? <small>{formatNumber(selectedOpnameGroup.qtyPcs)} PCS</small> : null}
              </div>
              <div>
                <span>Sumber</span>
                <b>{selectedOpnameGroup.sourceLabel || '-'}</b>
                <small>{selectedOpnameGroup.asalLabel || '-'}</small>
              </div>
              <div>
                <span>Aksi</span>
                <b>Pilih rincian</b>
                <small>Klik Opname pada ID/batch yang akan dicek fisik.</small>
              </div>
            </div>

            <div className="opname-card-list opname-detail-list">
              {selectedOpnameGroup.rows.map((item) => (
                <div className="opname-item-card opname-action-card opname-detail-row" key={`${item.source}-${item.id}`}>
                  <div>
                    <b>{item.nama || '-'}</b>
                    <small>{item.kode || '-'} • {item.source} • Ref {item.id || '-'}</small>
                    <small>{item.asal}</small>
                    {item.keterangan && <small>{item.keterangan}</small>}
                  </div>
                  <div className="opname-card-right">
                    <strong>
                      {formatNumber(item.qtyKg)} KG{item.qtyPcs ? ` / ${formatNumber(item.qtyPcs)} PCS` : ''}
                    </strong>
                    <button type="button" className="mini-btn" onClick={() => selectOpnameItem(item)}>
                      Opname
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(opnameView === 'ALL' || opnameView === 'WASTE') && (
          <section className="dashboard-section opname-section">
            <div className="dashboard-section-head">
              <h3>Data Stok Opname Waste</h3>
              <span>{stockOpnameData.wasteGroups.length} jenis • {stockOpnameData.wasteRows.length} rincian • {formatNumber(stockOpnameData.totalWasteKg)} KG</span>
            </div>
            <div className="opname-group-grid">
              {stockOpnameData.wasteGroups.map((group) => (
                <button
                  type="button"
                  className={`opname-group-card ${selectedOpnameGroup?.groupKey === group.groupKey ? 'active' : ''}`}
                  key={group.groupKey}
                  onClick={() => selectOpnameGroup(group)}
                >
                  <div>
                    <b>{group.nama || '-'}</b>
                    <small>{group.kode || '-'} • {group.sourceLabel}</small>
                    <small>{group.rowCount} rincian stok</small>
                  </div>
                  <strong>{formatNumber(group.qtyKg)} KG</strong>
                  <span className="click-hint">Klik untuk rincian & opname</span>
                </button>
              ))}
              {stockOpnameData.wasteGroups.length === 0 && <div className="empty-state">Tidak ada stok waste sesuai filter.</div>}
            </div>
          </section>
        )}

        {(opnameView === 'ALL' || opnameView === 'BUBUK') && (
          <section className="dashboard-section opname-section">
            <div className="dashboard-section-head">
              <h3>Data Stok Opname Bubuk</h3>
              <span>{stockOpnameData.bubukGroups.length} jenis • {stockOpnameData.bubukRows.length} batch • {formatNumber(stockOpnameData.totalBubukKg)} KG</span>
            </div>
            <div className="opname-group-grid">
              {stockOpnameData.bubukGroups.map((group) => (
                <button
                  type="button"
                  className={`opname-group-card purple ${selectedOpnameGroup?.groupKey === group.groupKey ? 'active' : ''}`}
                  key={group.groupKey}
                  onClick={() => selectOpnameGroup(group)}
                >
                  <div>
                    <b>{group.nama || '-'}</b>
                    <small>{group.kode || '-'} • {group.sourceLabel}</small>
                    <small>{group.rowCount} batch/rincian</small>
                  </div>
                  <strong>{formatNumber(group.qtyKg)} KG / {formatNumber(group.qtyPcs)} PCS</strong>
                  <span className="click-hint">Klik untuk batch & opname</span>
                </button>
              ))}
              {stockOpnameData.bubukGroups.length === 0 && <div className="empty-state">Tidak ada stok bubuk sesuai filter.</div>}
            </div>
          </section>
        )}

        {(opnameView === 'ALL' || opnameView === 'KOTOR') && (
          <section className="dashboard-section opname-section">
            <div className="dashboard-section-head">
              <h3>Data Waste Kotor</h3>
              <span>{stockOpnameData.kotorGroups.length} jenis • sisa sistem {formatNumber(stokKotor?.sisa_waste_kotor)} KG</span>
            </div>
            <div className="opname-group-grid">
              {stockOpnameData.kotorGroups.map((group) => (
                <button
                  type="button"
                  className={`opname-group-card danger ${selectedOpnameGroup?.groupKey === group.groupKey ? 'active' : ''}`}
                  key={group.groupKey}
                  onClick={() => selectOpnameGroup(group)}
                >
                  <div>
                    <b>{group.nama || '-'}</b>
                    <small>{group.kode || '-'} • {group.sourceLabel}</small>
                    <small>{group.rowCount} rincian</small>
                  </div>
                  <strong>{formatNumber(group.qtyKg)} KG</strong>
                  <span className="click-hint">Klik untuk rincian & opname</span>
                </button>
              ))}
              {stockOpnameData.kotorGroups.length === 0 && <div className="empty-state">Rincian waste kotor belum ada / belum sesuai filter.</div>}
            </div>
          </section>
        )}
      </>
    )}

    {opnameTab === 'input' && (
      <section className="dashboard-section opname-section">
        <div className="dashboard-section-head">
          <h3>Input Stock Opname Aktual</h3>
          <span>{selectedOpnameItem ? getOpnameTypeLabel(selectedOpnameItem.stockType) : 'Pilih item dulu'}</span>
        </div>

        {!selectedOpnameItem && (
          <div className="opname-picker-list">
            <div className="alert-note">
              Pilih item dari daftar di bawah, atau kembali ke tab Stok Sistem lalu klik tombol <b>Opname</b>.
            </div>

            {getOpnameCandidateRows().map((item) => (
              <button
                type="button"
                className="opname-picker-row"
                key={`${item.stockType}-${item.source}-${item.id}`}
                onClick={() => selectOpnameItem(item)}
              >
                <span>
                  <b>{item.nama || '-'}</b>
                  <small>{getOpnameTypeLabel(item.stockType)} • {item.kode || '-'} • {item.id || '-'}</small>
                  <small>{item.asal}</small>
                </span>
                <strong>{formatNumber(item.qtyKg)} KG</strong>
              </button>
            ))}

            {getOpnameCandidateRows().length === 0 && (
              <div className="empty-state">Tidak ada item sesuai filter.</div>
            )}
          </div>
        )}

        {selectedOpnameItem && (
          <form className="form-wrap opname-actual-form" onSubmit={submitStockOpname}>
            <div className="detail-box">
              <div className="detail-title">Item Dipilih</div>
              <div className="detail-grid">
                <span>Jenis</span><b>{getOpnameTypeLabel(selectedOpnameItem.stockType)}</b>
                <span>Kode</span><b>{selectedOpnameItem.kode || '-'}</b>
                <span>Nama</span><b>{selectedOpnameItem.nama || '-'}</b>
                <span>Referensi</span><b>{selectedOpnameItem.id || '-'}</b>
                <span>Asal</span><b>{selectedOpnameItem.asal || '-'}</b>
                <span>Stok Sistem KG</span><b>{formatNumber(selectedOpnameItem.qtyKg)} KG</b>
                <span>Stok Sistem PCS</span><b>{formatNumber(selectedOpnameItem.qtyPcs || 0)} PCS</b>
              </div>
            </div>

            <div className="inline-2">
              <div>
                <label>Stok Aktual KG</label>
                <input
                  inputMode="decimal"
                  value={opnameActualKg}
                  onChange={(e) => setOpnameActualKg(e.target.value)}
                  placeholder="Contoh: 120.5"
                />
              </div>
              <div>
                <label>Stok Aktual PCS</label>
                <input
                  inputMode="decimal"
                  value={opnameActualPcs}
                  onChange={(e) => setOpnameActualPcs(e.target.value)}
                  placeholder="Isi untuk bubuk, waste boleh 0"
                />
              </div>
            </div>

            <div className="opname-diff-preview">
              <div>
                <span>Selisih KG</span>
                <b>{formatNumber((parseNumber(opnameActualKg) || 0) - Number(selectedOpnameItem.qtyKg || 0))} KG</b>
              </div>
              <div>
                <span>Selisih PCS</span>
                <b>{formatNumber((parseNumber(opnameActualPcs) || 0) - Number(selectedOpnameItem.qtyPcs || 0))} PCS</b>
              </div>
            </div>

            <div>
              <label>Note Opname</label>
              <textarea
                value={opnameNote}
                onChange={(e) => setOpnameNote(e.target.value)}
                placeholder="Contoh: beda timbang fisik / pecah / basah / salah label / hasil hitung ulang"
              />
            </div>

            <button className="submit-btn" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Opname'}
            </button>

            <button type="button" className="ghost-btn wide" onClick={resetOpnameInput}>
              Batal / Pilih Item Lain
            </button>
          </form>
        )}
      </section>
    )}

    {opnameTab === 'pending' && (
      <section className="dashboard-section opname-section">
        <div className="dashboard-section-head">
          <h3>Pending Adjustment</h3>
          <span>{loadingAdjustments ? 'Loading...' : `${pendingAdjustments.length} koreksi menunggu approve`}</span>
        </div>

        <div className="alert-note">
          Adjustment yang di-approve akan masuk ke <b>stock_adjustment_log</b> dan stok live Supabase ikut terkoreksi di view stok.
        </div>

        <div className="opname-card-list">
          {loadingAdjustments && <div className="empty-state">Loading pending adjustment...</div>}

          {!loadingAdjustments && pendingAdjustments.length === 0 && (
            <div className="empty-state">Tidak ada pending adjustment.</div>
          )}

          {!loadingAdjustments && pendingAdjustments.map((item) => (
            <div className="opname-item-card pending-adjustment-card" key={item.id}>
              <div>
                <b>{item.nama_item || '-'}</b>
                <small>{getOpnameTypeLabel(item.stock_type)} • {item.kode_item || '-'} • Ref {item.ref_id || '-'}</small>
                <small>{item.asal || '-'}</small>
                <small>
                  Sistem: {formatNumber(item.stok_sistem_kg)} KG / {formatNumber(item.stok_sistem_pcs)} PCS • Aktual:{' '}
                  {formatNumber(item.stok_aktual_kg)} KG / {formatNumber(item.stok_aktual_pcs)} PCS
                </small>
                <small>{item.note || '-'}</small>
              </div>

              <div className="pending-right">
                <strong>
                  {formatNumber(item.selisih_kg)} KG
                  {Number(item.selisih_pcs || 0) !== 0 ? ` / ${formatNumber(item.selisih_pcs)} PCS` : ''}
                </strong>
                <div className="pending-actions">
                  <button type="button" className="mini-btn" disabled={submitting} onClick={() => approveStockAdjustment(item)}>
                    Approve
                  </button>
                  <button type="button" className="mini-btn danger" disabled={submitting} onClick={() => rejectStockAdjustment(item)}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    <div className="bottom-actions">
      <button type="button" className="ghost-btn wide" onClick={() => setPage('home')}>Back</button>
    </div>
  </main>
)}


{page === 'dashboard' && (
  <main className={`page-card dashboard-page glamour-dashboard ${dashTvMode ? 'tv-mode' : ''}`}>
    <div className="dashboard-lux-hero">
      <div>
        <span className="lux-kicker">BSWP CONTROL TOWER</span>
        <h2>Dashboard BSWP Live</h2>
        <p>
          Stok live, trend waste, top waste, hasil giling per shift, alert expired,
          dan export PDF dalam satu layar.
        </p>
      </div>

      <div className="lux-clock">
        <div>
          <span>Tanggal</span>
          <b>{formatDate(clock)}</b>
        </div>
        <div>
          <span>Jam</span>
          <b>{formatTime(clock)}</b>
        </div>
        <div>
          <span>Shift</span>
          <b>{getShiftByDate(clock)}</b>
        </div>
      </div>
    </div>

    <div className="dashboard-toolbar print-hide">
      <div className="filter-grid">
        <div>
          <label>Dari Tanggal</label>
          <input
            type="date"
            value={dashStartDate}
            onChange={(e) => setDashStartDate(e.target.value)}
          />
        </div>

        <div>
          <label>Sampai Tanggal</label>
          <input
            type="date"
            value={dashEndDate}
            onChange={(e) => setDashEndDate(e.target.value)}
          />
        </div>

        <div>
          <label>Plant</label>
          <select value={dashPlant} onChange={(e) => setDashPlant(e.target.value)}>
            <option value="ALL">Semua Plant</option>
            {['1111', '1112', '1113'].map((plant) => (
              <option key={plant} value={plant}>
                {plant}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Line</label>
          <select value={dashLine} onChange={(e) => setDashLine(e.target.value)}>
            <option value="ALL">Semua Line</option>
            <option value="All line">All line</option>
            {['1', '2', '3', '4', '5'].map((lineItem) => (
              <option key={lineItem} value={lineItem}>
                Line {lineItem}
              </option>
            ))}
          </select>
        </div>

        <div className="flow-filter-card">
          <label>Jenis Waste</label>
          <select value={dashWasteFlow} onChange={(e) => setDashWasteFlow(e.target.value)}>
            {DASHBOARD_FLOW_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-search">
          <label>Search</label>
          <input
            value={dashSearch}
            onChange={(e) => setDashSearch(e.target.value)}
            placeholder="Nama waste / batch / no PRO..."
          />
        </div>
      </div>

      <div className="quick-filter-row">
        <button type="button" className="chip-btn" onClick={() => quickSetDashboardPeriod(0)}>
          Hari Ini
        </button>
        <button type="button" className="chip-btn" onClick={() => quickSetDashboardPeriod(-7)}>
          7 Hari
        </button>
        <button type="button" className="chip-btn" onClick={() => quickSetDashboardPeriod(-30)}>
          30 Hari
        </button>
        <button
          type="button"
          className={`chip-btn ${dashTvMode ? 'active' : ''}`}
          onClick={() => setDashTvMode((prev) => !prev)}
        >
          TV Mode
        </button>
        <button
          type="button"
          className={`chip-btn ${dashAutoRefresh ? 'active' : ''}`}
          onClick={() => setDashAutoRefresh((prev) => !prev)}
        >
          Auto Refresh {dashAutoRefresh ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="chip-btn shine" onClick={() => {
          refreshAll();
          loadDashboardAnalytics();
        }}>
          Refresh
        </button>
        <button type="button" className="chip-btn gold" onClick={handleExportDashboardPdf}>
          Export PDF
        </button>
        <button type="button" className="chip-btn emerald" onClick={() => setDashTab('laporan')}>
          Laporan Shift
        </button>
      </div>
    </div>

    <div className="dashboard-tabs print-hide">
      {[
        ['overview', 'Overview'],
        ['trend', 'Trend & Chart'],
        ['source', 'Sumber Waste'],
        ['top', 'Top Waste'],
        ['hasil', 'Analisa Giling'],
        ['aging', 'Lifetime / Slow Moving'],
        ['laporan', 'Laporan Shift'],
        ['alert', `Alert Center (${dashboardAllAlerts.length})`],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={dashTab === key ? 'active' : ''}
          onClick={() => setDashTab(key)}
        >
          {label}
        </button>
      ))}
    </div>

    {loadingDashboardAnalytics && (
      <div className="lux-loading">Loading analytics dashboard...</div>
    )}

    <div className="dashboard-summary lux-summary capacity-summary-grid">
      <div className="dash-card neon green">
        <span>Waste Gudang</span>
        <b>{formatNumber(dashboardFilteredSummary.totalWasteGudang)} KG</b>
        <small>{dashboardFilteredSummary.totalWasteGudangId} ID aktif</small>
      </div>

      <div className="dash-card neon cyan">
        <span>Proses Giling</span>
        <b>{formatNumber(dashboardFilteredSummary.totalProses)} KG</b>
        <small>{dashboardFilteredSummary.totalProsesId} ID proses</small>
      </div>

      <div className="dash-card neon purple capacity-mini-card">
        <span>Bubuk Bersih</span>
        <b>{formatNumber(dashboardFilteredSummary.totalBubukKg)} KG</b>
        <small>
          {formatNumber(dashboardFilteredSummary.totalBubukPcs)} PCS • {dashboardFilteredSummary.totalBatch} batch
        </small>
        <div className="capacity-line mini">
          <i style={{ width: `${clampPercent(dashboardFilteredSummary.bubukUtilPct)}%` }} />
        </div>
        <small>
          Utilisasi {formatPercent(dashboardFilteredSummary.bubukUtilPct)} dari {formatNumber(dashboardFilteredSummary.bubukCapacityKg)} KG
        </small>
      </div>

      <div className="dash-card neon gold capacity-mini-card">
        <span>Kapasitas Waste</span>
        <b>{formatNumber(dashboardFilteredSummary.totalWasteStorage)} KG</b>
        <small>Gudang + proses + kotor aktif</small>
        <div className="capacity-line mini danger">
          <i style={{ width: `${clampPercent(dashboardFilteredSummary.wasteUtilPct)}%` }} />
        </div>
        <small>
          Utilisasi {formatPercent(dashboardFilteredSummary.wasteUtilPct)} dari {formatNumber(dashboardFilteredSummary.wasteCapacityKg)} KG
        </small>
      </div>

      <div className="dash-card neon pink">
        <span>Alert Expired</span>
        <b>{dashboardFilteredSummary.totalAlert}</b>
        <small>Batch perlu action</small>
      </div>
    </div>

    {dashTab === 'overview' && (
      <>
        <section className="dashboard-section lux-section capacity-control-panel">
          <div className="dashboard-section-head">
            <h3>Kapasitas Gudang</h3>
            <span>Bubuk 180.000 KG • Waste estimasi 15.000 KG</span>
          </div>

          <div className="capacity-card-grid">
            <div className="capacity-card">
              <div className="capacity-card-head">
                <div>
                  <b>Gudang Bubuk Bersih</b>
                  <small>Stok live bubuk bersih aktif</small>
                </div>
                <em className={`capacity-pill ${dashboardFilteredSummary.bubukUtilStatus.className}`}>
                  {dashboardFilteredSummary.bubukUtilStatus.label}
                </em>
              </div>
              <div className="capacity-numbers">
                <strong>{formatNumber(dashboardFilteredSummary.totalBubukKg)} KG</strong>
                <span>/ {formatNumber(dashboardFilteredSummary.bubukCapacityKg)} KG</span>
              </div>
              <div className="capacity-line">
                <i style={{ width: `${clampPercent(dashboardFilteredSummary.bubukUtilPct)}%` }} />
              </div>
              <small>Utilisasi {formatPercent(dashboardFilteredSummary.bubukUtilPct)}</small>
            </div>

            <div className="capacity-card waste">
              <div className="capacity-card-head">
                <div>
                  <b>Kapasitas Waste</b>
                  <small>Waste gudang + proses giling + waste kotor</small>
                </div>
                <em className={`capacity-pill ${dashboardFilteredSummary.wasteUtilStatus.className}`}>
                  {dashboardFilteredSummary.wasteUtilStatus.label}
                </em>
              </div>
              <div className="capacity-numbers">
                <strong>{formatNumber(dashboardFilteredSummary.totalWasteStorage)} KG</strong>
                <span>/ {formatNumber(dashboardFilteredSummary.wasteCapacityKg)} KG</span>
              </div>
              <div className="capacity-line danger">
                <i style={{ width: `${clampPercent(dashboardFilteredSummary.wasteUtilPct)}%` }} />
              </div>
              <small>Utilisasi {formatPercent(dashboardFilteredSummary.wasteUtilPct)}</small>
            </div>
          </div>
        </section>

        <div className="dashboard-duo overview-insight-grid">
          <section className="dashboard-section lux-section source-overview-panel">
            <div className="dashboard-section-head">
              <h3>Top 5 Penghasil Waste</h3>
              <span>Berdasarkan histori waste masuk</span>
            </div>

            <div className="source-rank-list">
              {dashboardTopWasteSource.slice(0, 5).map((item, index) => (
                <button
                  type="button"
                  className="source-rank-card"
                  key={item.key}
                  onClick={() => setSourceDetail(item)}
                >
                  <em className={`rank-badge ${index === 0 ? 'r1' : index === 1 ? 'r2' : index === 2 ? 'r3' : 'rn'}`}>
                    {index + 1}
                  </em>
                  <div>
                    <b>{item.area} • {item.shift} • Line {item.line}</b>
                    <small>Plant {item.plant} • {item.count} input • klik untuk detail waste</small>
                    <i><span style={{ width: `${Math.min(100, (item.qty / dashboardTopWasteSourceMax) * 100)}%` }} /></i>
                  </div>
                  <strong>{formatNumber(item.qty)} KG</strong>
                </button>
              ))}

              {dashboardTopWasteSource.length === 0 && (
                <div className="empty-state">Belum ada data sumber waste sesuai filter.</div>
              )}
            </div>
          </section>

          <section className="dashboard-section lux-section aging-overview-panel">
            <div className="dashboard-section-head">
              <h3>Lifetime & Slow Moving</h3>
              <span>{dashboardAgingAlerts.length} batch perlu monitoring</span>
            </div>

            <div className="aging-mini-list">
              {dashboardAgingRows.slice(0, 5).map((item) => (
                <div className="aging-mini-row" key={item.no_batch_bubuk}>
                  <div>
                    <b>{item.no_batch_bubuk}</b>
                    <small>{item.nama_bubuk || '-'} • umur {item.lifetime.ageDays} hari • sisa {formatNumber(item.sisa_bubuk_bersih)} KG</small>
                  </div>
                  <em className={`aging-pill ${item.lifetime.movementClass}`}>{item.lifetime.movementLabel}</em>
                </div>
              ))}

              {dashboardAgingRows.length === 0 && (
                <div className="empty-state">Belum ada stok bubuk untuk aging.</div>
              )}
            </div>
          </section>
        </div>

        <section className="dashboard-section lux-section forecast-panel">
          <div className="dashboard-section-head">
            <h3>Forecast Kapasitas Waste</h3>
            <span>Rata-rata masuk {formatNumber(dashboardFilteredSummary.avgDailyWasteMasuk)} KG/hari</span>
          </div>
          <div className={`forecast-card ${dashboardFilteredSummary.wasteForecast.level}`}>
            <b>{dashboardFilteredSummary.wasteForecast.label}</b>
            <small>Estimasi dihitung dari trend waste masuk pada periode filter. Gunakan sebagai early warning, bukan angka final operasional.</small>
          </div>
        </section>

        <section className="dashboard-section lux-section">
          <div className="dashboard-section-head">
            <h3>Stok Live Bubuk Bersih + Expired</h3>
            <span>{dashboardFiltered.stokBubuk.length} batch</span>
          </div>

          <div className="dashboard-list">
            {[...dashboardFiltered.stokBubuk]
              .sort((a, b) => String(a.expired_date || '').localeCompare(String(b.expired_date || '')))
              .slice(0, dashTvMode ? 6 : 12)
              .map((item) => {
                const exp = getExpiredStatus(item.expired_date);

                return (
                  <div className="dashboard-row batch-row luxe-row" key={item.no_batch_bubuk}>
                    <div>
                      <b>{item.no_batch_bubuk}</b>
                      <small>{item.nama_bubuk || '-'}</small>
                      <small>
                        Plant {item.plant_asal || '-'} • Line {item.line || '-'} • Giling {item.tanggal || '-'}
                      </small>
                    </div>

                    <div className="dash-row-right">
                      <strong>{formatNumber(item.sisa_bubuk_bersih)} KG</strong>
                      <small>{formatNumber(item.sisa_pcs_bersih)} PCS</small>
                      <em className={`expired-pill ${exp.className}`}>{exp.label}</em>
                    </div>
                  </div>
                );
              })}

            {!loadingBubuk && dashboardFiltered.stokBubuk.length === 0 && (
              <div className="empty-state">Tidak ada stok bubuk bersih sesuai filter.</div>
            )}
          </div>
        </section>

        <section className="dashboard-section lux-section live-receiving-panel">
          <div className="dashboard-section-head">
            <h3>Live Penerimaan Waste</h3>
            <span>Urutan penerimaan sesuai scan/input waste masuk</span>
          </div>

          <div className="live-shift-grid">
            {dashboardLivePenerimaanByShift.map((shift) => (
              <button
                type="button"
                className="live-shift-card"
                key={shift.shift}
                onClick={() => setLivePenerimaanDetail(shift)}
              >
                <div className="live-shift-head">
                  <div>
                    <b>{shift.shift}</b>
                    <small>{shift.count} penerimaan</small>
                  </div>
                  <strong>{formatNumber(shift.qty)} KG</strong>
                </div>

                <div className="live-mini-list">
                  {shift.details.slice(0, dashTvMode ? 3 : 5).map((item, index) => (
                    <div className="live-mini-row" key={`${item.id || item.id_waste_masuk || index}-${index}`}>
                      <span>{item.jam_input || '-'}</span>
                      <b>{item.nama_waste || '-'}</b>
                      <em>{formatNumber(item.qty_masuk)} KG</em>
                    </div>
                  ))}

                  {shift.details.length === 0 && (
                    <div className="empty-state compact">Belum ada penerimaan.</div>
                  )}
                </div>

                {shift.details.length > (dashTvMode ? 3 : 5) && (
                  <small className="click-hint">Klik lihat semua {shift.details.length} input</small>
                )}
              </button>
            ))}
          </div>
        </section>

        <div className="dashboard-duo">
          <section className="dashboard-section lux-section">
            <div className="dashboard-section-head">
              <h3>Waste Gudang per Jenis</h3>
              <span>{dashboardWasteGudangByJenis.length} jenis • {dashboardFiltered.wasteGudang.length} ID</span>
            </div>

            <div className="dashboard-list">
              {dashboardWasteGudangByJenis.slice(0, dashTvMode ? 5 : 10).map((item) => (
                <button
                  type="button"
                  className="dashboard-row luxe-row clickable-row"
                  key={item.key}
                  onClick={() => setWasteGudangDetail(item)}
                >
                  <div>
                    <b>{item.nama}</b>
                    <small>
                      {item.count} ID aktif • Plant {item.plants || '-'} • Line {item.lines || '-'}
                    </small>
                  </div>
                  <strong>{formatNumber(item.qty)} KG</strong>
                </button>
              ))}

              {!loadingGudang && dashboardWasteGudangByJenis.length === 0 && (
                <div className="empty-state">Tidak ada stok waste gudang sesuai filter.</div>
              )}
            </div>
          </section>

          <section className="dashboard-section lux-section">
            <div className="dashboard-section-head">
              <h3>Proses Giling</h3>
              <span>{dashboardFiltered.prosesGiling.length} ID</span>
            </div>

            <div className="dashboard-list">
              {dashboardFiltered.prosesGiling.slice(0, dashTvMode ? 5 : 10).map((item) => (
                <div className="dashboard-row luxe-row" key={item.id_waste_masuk}>
                  <div>
                    <b>{item.nama_waste}</b>
                    <small>
                      Bubuk {item.nama_bubuk || '-'} • Plant {item.plant_asal || '-'} • Line {item.line || '-'}
                    </small>
                  </div>
                  <strong>{formatNumber(item.sisa_proses_giling)} KG</strong>
                </div>
              ))}

              {!loadingProses && dashboardFiltered.prosesGiling.length === 0 && (
                <div className="empty-state">Tidak ada proses giling sesuai filter.</div>
              )}
            </div>
          </section>
        </div>
      </>
    )}

    {dashTab === 'trend' && (
      <div className="dashboard-duo chart-dashboard-grid">
        <section className="dashboard-section lux-section full-span chart-panel">
          <div className="dashboard-section-head">
            <h3>Trend Waste Masuk, Hasil Bersih, dan Pengiriman</h3>
            <span>
              {dashStartDate} s/d {dashEndDate}
            </span>
          </div>

          <div className="trend-insight-panel">
            <div className="trend-ratio-card hero-ratio">
              <span>Ratio Flow</span>
              <b>{dashboardTrendSummary.ratioText}</b>
              <small>Waste masuk : waste tergiling : bubuk dibon</small>
            </div>
            <div className="trend-ratio-card">
              <span>Waste Tergiling</span>
              <b>{formatPercent(dashboardTrendSummary.tergilingPct)}</b>
              <small>{formatNumber(dashboardTrendSummary.totalWasteTergiling)} KG dari waste masuk</small>
            </div>
            <div className="trend-ratio-card">
              <span>Yield Bersih</span>
              <b>{formatPercent(dashboardTrendSummary.yieldPct)}</b>
              <small>{formatNumber(dashboardTrendSummary.totalHasilBersih)} KG bubuk bersih</small>
            </div>
            <div className="trend-ratio-card">
              <span>Bubuk Dibon</span>
              <b>{formatPercent(dashboardTrendSummary.releasePct)}</b>
              <small>{formatNumber(dashboardTrendSummary.totalPengiriman)} KG dari hasil bersih</small>
            </div>
          </div>

          <div className="trend-conclusion-card">
            <b>Kesimpulan:</b>
            <span>{dashboardTrendSummary.conclusion}</span>
          </div>

          {dashboardTrend.length > 0 ? (
            <div className="chart-canvas big-chart">
              <ResponsiveContainer width="100%" height={dashTvMode ? 420 : 340}>
                <AreaChart data={dashboardTrend} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradWaste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.waste} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.waste} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradBersih" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.bersih} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={CHART_COLORS.bersih} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradKirim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.kirim} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={CHART_COLORS.kirim} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="tanggal" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => `${formatNumber(value)} KG`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="wasteMasuk" name="Waste Masuk" stroke={CHART_COLORS.waste} fill="url(#gradWaste)" strokeWidth={3} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="hasilBersih" name="Hasil Bersih" stroke={CHART_COLORS.bersih} fill="url(#gradBersih)" strokeWidth={3} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="pengiriman" name="Pengiriman" stroke={CHART_COLORS.kirim} fill="url(#gradKirim)" strokeWidth={3} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada data trend sesuai filter.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Perbandingan Flow Periode</h3>
            <span>Waste masuk : tergiling : dibon</span>
          </div>

          {dashboardTrendSummary.comparisonData.some((item) => item.qty > 0) ? (
            <div className="chart-canvas ratio-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardTrendSummary.comparisonData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Qty" fill={CHART_COLORS.gold} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada data perbandingan flow.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Bar Chart Harian</h3>
            <span>Waste vs Bersih vs Kirim</span>
          </div>

          {dashboardTrend.length > 0 ? (
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dashboardTrend} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="tanggal" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="wasteMasuk" name="Waste" fill={CHART_COLORS.waste} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="hasilBersih" name="Bersih" fill={CHART_COLORS.bersih} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pengiriman" name="Kirim" fill={CHART_COLORS.kirim} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada data bar chart.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Trend Pengiriman</h3>
            <span>Fokus output bubuk bersih</span>
          </div>

          {dashboardTrend.length > 0 ? (
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dashboardTrend} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="tanggal" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="pengiriman" name="Pengiriman" stroke={CHART_COLORS.kirim} strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="hasilBersih" name="Hasil Bersih" stroke={CHART_COLORS.bersih} strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada trend pengiriman.</div>
          )}
        </section>
      </div>
    )}


    {dashTab === 'source' && (
      <div className="dashboard-duo chart-dashboard-grid">
        <section className="dashboard-section lux-section full-span chart-panel">
          <div className="dashboard-section-head">
            <h3>Sumber Waste Terbesar</h3>
            <span>Area • shift • line berdasarkan histori waste masuk</span>
          </div>

          {dashboardTopWasteSource.length > 0 ? (
            <div className="chart-canvas big-chart">
              <ResponsiveContainer width="100%" height={dashTvMode ? 420 : 360}>
                <BarChart data={dashboardTopWasteSource} layout="vertical" margin={{ top: 12, right: 28, left: 18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={210} tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Total Waste" fill={CHART_COLORS.waste} radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada data sumber waste sesuai filter.</div>
          )}
        </section>

        <section className="dashboard-section lux-section full-span">
          <div className="dashboard-section-head">
            <h3>Detail Top Source</h3>
            <span>Klik salah satu baris untuk lihat waste detail</span>
          </div>

          <div className="source-rank-list full">
            {dashboardTopWasteSource.map((item, index) => (
              <button type="button" className="source-rank-card" key={item.key} onClick={() => setSourceDetail(item)}>
                <em className={`rank-badge ${index === 0 ? 'r1' : index === 1 ? 'r2' : index === 2 ? 'r3' : 'rn'}`}>{index + 1}</em>
                <div>
                  <b>{item.area} • {item.shift} • Line {item.line}</b>
                  <small>Plant {item.plant} • {item.count} input waste</small>
                  <i><span style={{ width: `${Math.min(100, (item.qty / dashboardTopWasteSourceMax) * 100)}%` }} /></i>
                </div>
                <strong>{formatNumber(item.qty)} KG</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    )}

    {dashTab === 'top' && (
      <div className="dashboard-duo chart-dashboard-grid">
        <section className="dashboard-section lux-section full-span chart-panel">
          <div className="dashboard-section-head">
            <h3>Top 10 Waste Masuk Periode</h3>
            <span>{dashboardTopWasteMasuk.length} item</span>
          </div>

          {dashboardTopWasteMasuk.length > 0 ? (
            <div className="chart-canvas horizontal-chart">
              <ResponsiveContainer width="100%" height={Math.max(330, dashboardTopWasteMasuk.length * 42)}>
                <BarChart data={dashboardTopWasteMasuk} layout="vertical" margin={{ top: 12, right: 24, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={dashTvMode ? 260 : 190} tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Qty Waste Masuk" fill={CHART_COLORS.waste} radius={[0, 12, 12, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada top waste sesuai filter.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Top Waste Saat Ini di Gudang</h3>
            <span>{dashboardTopWasteCurrent.length} item</span>
          </div>

          {dashboardTopWasteCurrent.length > 0 ? (
            <div className="chart-canvas horizontal-chart small-horizontal-chart">
              <ResponsiveContainer width="100%" height={Math.max(280, dashboardTopWasteCurrent.length * 38)}>
                <BarChart data={dashboardTopWasteCurrent} layout="vertical" margin={{ top: 8, right: 20, left: 6, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={145} tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Sisa Gudang" fill={CHART_COLORS.gold} radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Tidak ada stok waste saat ini.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Top Bubuk Bersih Dikirim</h3>
            <span>{dashboardTopKirim.length} item</span>
          </div>

          {dashboardTopKirim.length > 0 ? (
            <div className="chart-canvas horizontal-chart small-horizontal-chart">
              <ResponsiveContainer width="100%" height={Math.max(280, dashboardTopKirim.length * 38)}>
                <BarChart data={dashboardTopKirim} layout="vertical" margin={{ top: 8, right: 20, left: 6, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis type="number" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={145} tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Qty Kirim" fill={CHART_COLORS.kirim} radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada pengiriman sesuai filter.</div>
          )}
        </section>
      </div>
    )}

    {dashTab === 'hasil' && (
      <div className="dashboard-duo chart-dashboard-grid">
        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Analisa Hasil Giling Per Shift</h3>
            <span>{dashboardHasilByShift.length} shift</span>
          </div>

          {dashboardHasilByShift.length > 0 ? (
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={dashboardHasilByShift} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="shift" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="proses" name="Proses" fill={CHART_COLORS.proses} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="bersih" name="Bersih" fill={CHART_COLORS.bersih} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="kotor" name="Kotor" fill={CHART_COLORS.kotor} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada hasil giling per shift.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Trend Hasil Giling Per Hari</h3>
            <span>{dashboardHasilByDay.length} hari</span>
          </div>

          {dashboardHasilByDay.length > 0 ? (
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={330}>
                <AreaChart data={dashboardHasilByDay} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradHasilDay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.bersih} stopOpacity={0.38} />
                      <stop offset="95%" stopColor={CHART_COLORS.bersih} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="tanggal" tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="bersih" name="Bersih" stroke={CHART_COLORS.bersih} fill="url(#gradHasilDay)" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="kotor" name="Kotor" stroke={CHART_COLORS.kotor} strokeWidth={3} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada hasil giling per hari.</div>
          )}
        </section>

        <section className="dashboard-section lux-section full-span">
          <div className="dashboard-section-head">
            <h3>Yield Anomaly & Top Loss</h3>
            <span>Batch dengan yield rendah / kotor tinggi</span>
          </div>

          <div className="dashboard-duo anomaly-grid">
            <div className="dashboard-list">
              <div className="section-mini-title">Yield di bawah 70%</div>
              {dashboardYieldAnomalies.slice(0, 5).map((item) => (
                <div className="dashboard-row alert-row" key={`yield-${item.id || item.no_batch_bubuk}`}>
                  <div>
                    <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                    <small>{item.tanggal} • {item.shift || '-'} • Plant {item.plant_asal || '-'} • Line {item.line || '-'}</small>
                    <small>Waste: {item.nama_waste || '-'}</small>
                  </div>
                  <strong>{formatPercent(item.yieldValue)}</strong>
                </div>
              ))}
              {dashboardYieldAnomalies.length === 0 && <div className="empty-state">Tidak ada yield anomaly sesuai filter.</div>}
            </div>

            <div className="dashboard-list">
              <div className="section-mini-title">Top kotor / loss</div>
              {dashboardTopLoss.slice(0, 5).map((item) => (
                <div className="dashboard-row luxe-row" key={`loss-${item.id || item.no_batch_bubuk}`}>
                  <div>
                    <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                    <small>{item.tanggal} • {item.shift || '-'} • Waste {item.nama_waste || '-'}</small>
                    <small>Yield {formatPercent(item.yieldValue)} • Bersih {formatNumber(item.qty_bersih)} KG</small>
                  </div>
                  <strong>{formatNumber(item.qty_kotor)} KG kotor</strong>
                </div>
              ))}
              {dashboardTopLoss.length === 0 && <div className="empty-state">Belum ada data loss sesuai filter.</div>}
            </div>
          </div>
        </section>

        <section className="dashboard-section lux-section full-span">
          <div className="dashboard-section-head">
            <h3>Rincian Batch Hasil Giling</h3>
            <span>{dashboardFiltered.hasilGiling.length} batch</span>
          </div>

          <div className="dashboard-list">
            {dashboardFiltered.hasilGiling.slice(0, 20).map((item) => (
              <div className="dashboard-row luxe-row" key={item.id || item.no_batch_bubuk}>
                <div>
                  <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                  <small>
                    {item.tanggal} • {item.shift || '-'} • Plant {item.plant_asal || '-'} • Line {item.line || '-'}
                  </small>
                  <small>
                    Waste: {item.nama_waste || '-'} • Expired {item.expired_date || '-'}
                  </small>
                </div>
                <strong>
                  {formatNumber(item.qty_bersih)} KG / {formatNumber(item.qty_kotor)} KG kotor
                </strong>
              </div>
            ))}

            {dashboardFiltered.hasilGiling.length === 0 && (
              <div className="empty-state">Belum ada rincian hasil giling sesuai filter.</div>
            )}
          </div>
        </section>
      </div>
    )}


    {dashTab === 'aging' && (
      <div className="dashboard-duo chart-dashboard-grid">
        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Distribusi Lifetime Batch</h3>
            <span>Fast, normal, watchlist, slow moving</span>
          </div>

          {dashboardAgingDistribution.some((item) => item.qty > 0) ? (
            <div className="chart-canvas">
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={dashboardAgingDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,175,255,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value) => `${formatNumber(value)} KG`} />
                  <Bar dataKey="qty" name="Sisa KG" fill={CHART_COLORS.gold} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Belum ada data lifetime sesuai filter.</div>
          )}
        </section>

        <section className="dashboard-section lux-section chart-panel">
          <div className="dashboard-section-head">
            <h3>Slow Moving Watchlist</h3>
            <span>{dashboardAgingAlerts.length} batch</span>
          </div>

          <div className="dashboard-list">
            {dashboardAgingAlerts.slice(0, 12).map((item) => (
              <div className="dashboard-row alert-row" key={`aging-alert-${item.no_batch_bubuk}`}>
                <div>
                  <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                  <small>Umur {item.lifetime.ageDays} hari • Movement {formatPercent(item.lifetime.movementPct)} • Sisa {formatPercent(item.lifetime.sisaPct)}</small>
                  <small>Plant {item.plant_asal || '-'} • Line {item.line || '-'} • Expired {item.expired_date || '-'}</small>
                </div>
                <em className={`aging-pill ${item.lifetime.movementClass}`}>{item.lifetime.movementLabel}</em>
              </div>
            ))}
            {dashboardAgingAlerts.length === 0 && <div className="empty-state">Tidak ada batch slow moving sesuai filter.</div>}
          </div>
        </section>

        <section className="dashboard-section lux-section full-span">
          <div className="dashboard-section-head">
            <h3>Rincian Lifetime Semua Batch</h3>
            <span>{dashboardAgingRows.length} batch</span>
          </div>

          <div className="dashboard-list">
            {dashboardAgingRows.slice(0, 40).map((item) => (
              <div className="dashboard-row luxe-row" key={`aging-${item.no_batch_bubuk}`}>
                <div>
                  <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                  <small>Giling {item.lifetime.tanggalGiling || '-'} • Expired {item.expired_date || '-'} • Umur {item.lifetime.ageDays} hari</small>
                  <small>Movement {formatPercent(item.lifetime.movementPct)} • Sisa {formatNumber(item.sisa_bubuk_bersih)} KG dari awal {formatNumber(item.lifetime.awalKg)} KG</small>
                </div>
                <em className={`aging-pill ${item.lifetime.movementClass}`}>{item.lifetime.movementLabel}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    )}

    {dashTab === 'laporan' && (
      <section className="dashboard-section lux-section shift-report-section">
        <div className="dashboard-section-head print-hide">
          <div>
            <h3>Laporan Shift 1 Halaman</h3>
            <span>Periode {dashStartDate === dashEndDate ? dashStartDate : `${dashStartDate} s/d ${dashEndDate}`} • cocok untuk screenshot/PDF WA</span>
          </div>
          <div className="report-action-row">
            <button type="button" className="mini-btn" onClick={handlePrintShiftReport}>
              PDF / Print
            </button>
            <button type="button" className="mini-btn gold" onClick={handleExportShiftReportExcel}>
              Download Excel
            </button>
          </div>
        </div>

        <div className="shift-report-sheet">
          <div className="shift-report-title">
            <div>
              <span>BSWP SHIFT REPORT</span>
              <h3>Laporan Waste, Giling, dan Bonan</h3>
              <small>{dashStartDate === dashEndDate ? dashStartDate : `${dashStartDate} s/d ${dashEndDate}`} • dibuat {formatDate(clock)} {formatTime(clock)}</small>
            </div>
            <div className="shift-report-badges">
              <b>{getShiftByDate(clock)}</b>
              <span>Live</span>
            </div>
          </div>

          <div className="shift-report-kpi-grid">
            <div>
              <span>Waste Masuk</span>
              <b>{formatNumber(dashboardShiftReport.totals.wasteKg)} KG</b>
              <small>{dashboardShiftReport.totals.wasteCount} input</small>
            </div>
            <div>
              <span>Hasil Bubuk</span>
              <b>{formatNumber(dashboardShiftReport.totals.hasilBubukKg)} KG</b>
              <small>Waste proses {formatNumber(dashboardShiftReport.totals.hasilWasteKg)} KG</small>
            </div>
            <div>
              <span>Masih Progress</span>
              <b>{formatNumber(dashboardShiftReport.totals.progressKg)} KG</b>
              <small>Belum jadi bubuk</small>
            </div>
            <div>
              <span>Bonan</span>
              <b>{formatNumber(dashboardShiftReport.totals.bonanKg)} KG</b>
              <small>{formatNumber(dashboardShiftReport.totals.bonanPcs)} PCS</small>
            </div>
          </div>

          <div className="shift-report-grid">
            <div className="shift-report-block">
              <h4>Waste Masuk per Shift</h4>
              {dashboardShiftReport.shifts.map((shift) => (
                <div className="shift-mini-table" key={`waste-${shift.shift}`}>
                  <div className="shift-mini-head">
                    <b>{shift.shift}</b>
                    <span>{formatNumber(shift.wasteTotalKg)} KG</span>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Area</th>
                        <th>Waste</th>
                        <th>KG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.wasteRows.slice(0, 12).map((item) => (
                        <tr key={`${shift.shift}-${item.bucketKey}-${item.kode}-${item.nama}`}>
                          <td>{item.bucketLabel}</td>
                          <td>{item.nama}</td>
                          <td>{formatNumber(item.qtyKg)}</td>
                        </tr>
                      ))}
                      {shift.wasteRows.length === 0 && (
                        <tr><td colSpan="3">Belum ada data</td></tr>
                      )}
                      {shift.wasteRows.length > 12 && (
                        <tr><td colSpan="3">+{shift.wasteRows.length - 12} item lain di Excel</td></tr>
                      )}
                      <tr className="total-row">
                        <td colSpan="2">TOTAL</td>
                        <td>{formatNumber(shift.wasteTotalKg)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="shift-report-block">
              <h4>Hasil Giling per Shift</h4>
              {dashboardShiftReport.shifts.map((shift) => (
                <div className="shift-mini-table" key={`hasil-${shift.shift}`}>
                  <div className="shift-mini-head">
                    <b>{shift.shift}</b>
                    <span>{formatNumber(shift.hasilBubukKg)} KG bubuk</span>
                  </div>

                  <div className="hasil-summary-row">
                    <div><span>Waste Masuk</span><b>{formatNumber(shift.hasilWasteKg)} KG</b></div>
                    <div><span>Hasil Bubuk</span><b>{formatNumber(shift.hasilBubukKg)} KG</b></div>
                    <div><span>Progress</span><b>{formatNumber(shift.progressKg)} KG</b></div>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Bubuk</th>
                        <th>Waste</th>
                        <th>Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.hasilRows.slice(0, 8).map((item) => (
                        <tr key={`${shift.shift}-${item.kode}-${item.nama}`}>
                          <td>{item.nama}</td>
                          <td>{formatNumber(item.wasteKg)}</td>
                          <td>{formatNumber(item.bubukKg)}</td>
                        </tr>
                      ))}
                      {shift.hasilRows.length === 0 && (
                        <tr><td colSpan="3">Belum ada hasil giling</td></tr>
                      )}
                      <tr className="total-row">
                        <td>TOTAL</td>
                        <td>{formatNumber(shift.hasilWasteKg)}</td>
                        <td>{formatNumber(shift.hasilBubukKg)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="shift-report-block">
              <h4>Bonan per Shift</h4>
              {dashboardShiftReport.shifts.map((shift) => (
                <div className="shift-mini-table" key={`bonan-${shift.shift}`}>
                  <div className="shift-mini-head">
                    <b>{shift.shift}</b>
                    <span>{formatNumber(shift.bonanPcs)} PCS • {formatNumber(shift.bonanKg)} KG</span>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Bubuk</th>
                        <th>PCS</th>
                        <th>KG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.bonanRows.slice(0, 12).map((item) => (
                        <tr key={`${shift.shift}-${item.kode}-${item.nama}`}>
                          <td>{item.nama}</td>
                          <td>{formatNumber(item.qtyPcs)}</td>
                          <td>{formatNumber(item.qtyKg)}</td>
                        </tr>
                      ))}
                      {shift.bonanRows.length === 0 && (
                        <tr><td colSpan="3">Belum ada bonan</td></tr>
                      )}
                      {shift.bonanRows.length > 12 && (
                        <tr><td colSpan="3">+{shift.bonanRows.length - 12} item lain di Excel</td></tr>
                      )}
                      <tr className="total-row">
                        <td>TOTAL</td>
                        <td>{formatNumber(shift.bonanPcs)}</td>
                        <td>{formatNumber(shift.bonanKg)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )}

    {dashTab === 'alert' && (
      <section className="dashboard-section lux-section alert-section">
        <div className="dashboard-section-head">
          <h3>Alert Center Expired & Slow Moving</h3>
          <span>{dashboardAllAlerts.length} alert perlu monitoring</span>
        </div>

        <div className="alert-note">
          <b>Rule:</b> 3 bulan mendekati expired = monitoring & rencana pemakaian.
          1 bulan mendekati expired = prioritas action. Slow moving = batch tua dengan stok masih besar, perlu evaluasi bon/pakai/jual/musnahkan.
        </div>

        <div className="dashboard-list">
          {dashboardAllAlerts.map((item) => {
            const lifetime = item.lifetime || getBatchLifetimeInfo(item);
            const isAging = item.alertType === 'aging';
            const key = `${item.alertType}-${item.no_batch_bubuk}`;

            return (
              <div className="dashboard-row alert-row" key={key}>
                <div>
                  <b>{item.no_batch_bubuk} • {item.nama_bubuk || '-'}</b>
                  <small>
                    {isAging
                      ? `Slow moving: umur ${lifetime.ageDays} hari • movement ${formatPercent(lifetime.movementPct)}`
                      : `Expired ${item.expired_date || '-'} • Status ${item.expiredStatus.label}`}
                  </small>
                  <small>
                    Sisa {formatNumber(item.sisa_bubuk_bersih)} KG • {formatNumber(item.sisa_pcs_bersih)} PCS
                  </small>
                  <small>
                    Rekomendasi: {isAging
                      ? 'Evaluasi demand/bon produksi. Jika tidak bergerak, siapkan rencana pakai cepat, jual, musnahkan, atau adjustment.'
                      : item.expiredStatus.level === 'expired'
                      ? 'STOP pakai normal, follow up pemusnahan / jual / adjustment.'
                      : item.expiredStatus.level === '1bulan'
                      ? 'Prioritas action segera: pakai cepat / jual / musnahkan.'
                      : 'Monitoring, buat rencana pemakaian sebelum masuk 1 bulan.'}
                  </small>
                </div>

                {isAging ? (
                  <em className={`aging-pill ${lifetime.movementClass}`}>{lifetime.movementLabel}</em>
                ) : (
                  <em className={`expired-pill ${item.expiredStatus.className}`}>{item.expiredStatus.label}</em>
                )}
              </div>
            );
          })}

          {dashboardAllAlerts.length === 0 && (
            <div className="empty-state">Aman. Tidak ada expired / slow moving sesuai filter.</div>
          )}
        </div>
      </section>
    )}

    <div className="bottom-actions print-hide">
      <button type="button" className="ghost-btn wide" onClick={() => setPage('home')}>
        Back
      </button>

      <button type="button" className="ghost-btn wide" onClick={() => {
        refreshAll();
        loadDashboardAnalytics();
      }}>
        Refresh Dashboard
      </button>
    </div>
  </main>
)}


      {page === 'wasteMasuk' && (
  <main className="page-card">
    <div className="info-card">
      <h3>Input Waste Masuk Batch</h3>

      <div className="info-grid">
        <div>
          <span>Tanggal</span>
          <b>{formatDate(clock)}</b>
        </div>

        <div>
          <span>Jam</span>
          <b>{formatTime(clock)}</b>
        </div>

        <div>
          <span>Shift</span>
          <b>{getShiftByDate(clock)}</b>
        </div>

        <div>
          <span>Jumlah Detail</span>
          <b>{wasteRows.length} Waste</b>
        </div>
      </div>
    </div>

    <form className="form-wrap" onSubmit={submitWasteMasuk}>
      <div className="inline-2 pro-row">
        <div>
          <label>Kategori Waste</label>
          <select
            value={kategoriWaste}
            onChange={(e) => setKategoriWaste(e.target.value)}
          >
            <option value="">Pilih kategori</option>
            {KATEGORI_WASTE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>No PRO / Keterangan</label>
          <input
            value={noProKeterangan}
            onChange={(e) => setNoProKeterangan(e.target.value)}
            placeholder={
              kategoriWaste === 'PRO'
                ? 'Contoh: PRO-250615-001'
                : 'Isi keterangan traceability'
            }
          />
        </div>
      </div>

      <label>Area Asal</label>
      <select value={areaAsal} onChange={(e) => setAreaAsal(e.target.value)}>
        <option value="">Pilih area asal</option>
        {AREA_OPTIONS.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>

      <div className="batch-header">
        <div>
          <b>Detail Waste</b>
          <small>1 No PRO / Keterangan bisa berisi beberapa waste</small>
        </div>

        <button type="button" className="add-row-btn" onClick={addWasteRow}>
          + Tambah Waste
        </button>
      </div>

      <div className="waste-row-list">
        {wasteRows.map((row, index) => {
          const suggestions = getFilteredWasteByKeyword(row.search);

          return (
            <section className="waste-row-card" key={row.rowId}>
              <div className="row-card-title">
                <b>Waste {index + 1}</b>

                <div className="row-actions">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => clearWasteRow(row.rowId)}
                  >
                    Clear
                  </button>

                  {wasteRows.length > 1 && (
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => removeWasteRow(row.rowId)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              <label>Nama Waste</label>
              <div className="search-wrap">
                <div className="search-row">
                  <input
                    value={row.search}
                    onChange={(e) =>
                      updateWasteRow(row.rowId, {
                        search: e.target.value,
                        selectedWaste: null,
                      })
                    }
                    placeholder="Ketik nama waste / kode waste..."
                  />

                  {row.search && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => clearWasteRow(row.rowId)}
                    >
                      ×
                    </button>
                  )}
                </div>

                {row.search && !row.selectedWaste && (
                  <div className="suggestion-box">
                    {loadingMaster && (
                      <div className="suggestion-item muted">Loading...</div>
                    )}

                    {!loadingMaster && suggestions.length === 0 && (
                      <div className="suggestion-item muted">
                        Tidak ada data.
                      </div>
                    )}

                    {suggestions.map((item) => (
                      <button
                        type="button"
                        className="suggestion-item"
                        key={`${row.rowId}-${item.id}`}
                        onClick={() => chooseWasteRow(row.rowId, item)}
                      >
                        <b>{item.kode_waste}</b>
                        <span>{item.nama_waste}</span>
                        <small>
                          Plant {item.plant || '-'} • Master Line{' '}
                          {item.line || '-'} • {item.tipe_waste}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {row.selectedWaste && (
                <div
                  className={
                    row.selectedWaste.tipe_waste === 'KOTOR'
                      ? 'detail-box danger-box'
                      : 'detail-box'
                  }
                >
                  <div className="detail-title">
                    {row.selectedWaste.tipe_waste === 'KOTOR'
                      ? 'LANGSUNG KOTOR'
                      : 'BISA DIGILING'}
                  </div>

                  <div className="detail-grid compact-detail">
  <span>Waste</span>
  <b>{row.selectedWaste.nama_waste}</b>

  <span>Plant</span>
  <b>{row.selectedWaste.plant || '-'}</b>

  <span>Tipe</span>
  <b>{row.selectedWaste.tipe_waste || '-'}</b>

  <span>Bubuk</span>
  <b>{row.selectedWaste.nama_bubuk || '-'}</b>
</div>
                </div>
              )}

              <div className="inline-4 waste-line-row">
                <div>
                  <label>Line</label>
                  <select
                    value={row.lineUtama}
                    onChange={(e) =>
                      updateWasteRow(row.rowId, {
                        lineUtama: e.target.value,
                        subLine:
                          e.target.value === 'All line'
                            ? ''
                            : e.target.value === 'Lainnya'
                            ? ''
                            : row.subLine || '1',
                      })
                    }
                  >
                    <option value="">Line</option>
                    {LINE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>.</label>
                  <input
                    value={row.subLine}
                    disabled={row.lineUtama === 'All line'}
                    onChange={(e) =>
                      updateWasteRow(row.rowId, {
                        subLine: e.target.value,
                      })
                    }
                    placeholder={
                      row.lineUtama === 'Lainnya'
                        ? 'Isi line'
                        : row.lineUtama === 'All line'
                        ? '-'
                        : '1'
                    }
                  />
                </div>

                <div>
                  <label>Qty KG</label>
                  <input
                    value={row.qtyMasuk}
                    onChange={(e) =>
                      updateWasteRow(row.rowId, {
                        qtyMasuk: e.target.value,
                      })
                    }
                    inputMode="decimal"
                    placeholder="Qty"
                  />
                </div>

                <div>
                  <label>Line Final</label>
                  <input value={previewLine(row)} disabled />
                </div>
              </div>

              <label>Keterangan Item</label>
              <input
                value={row.keterangan}
                onChange={(e) =>
                  updateWasteRow(row.rowId, {
                    keterangan: e.target.value,
                  })
                }
                placeholder="Contoh: 3 kantong / reject pecah / adjustment"
              />
            </section>
          );
        })}
      </div>

      <button className="submit-btn" disabled={submitting}>
        {submitting ? 'Menyimpan...' : 'Simpan Waste Masuk Batch'}
      </button>

      <div className="bottom-actions">
  <button
    type="button"
    className="ghost-btn wide"
    onClick={() => setPage('formMenu')}
  >
    Back
  </button>

  <button
    type="button"
    className="ghost-btn wide"
    onClick={openHistoryWasteMasuk}
  >
    Lihat History
  </button>
</div>

    </form>

    {notif && (
      <div className={`notif ${notif.type}`}>
        <b>{notif.message}</b>
        {notif.detail && <span>{notif.detail}</span>}
      </div>
    )}
  </main>
)}


      {page === 'prosesGiling' && (
        <main className="page-card">
          <div className="info-card">
            <h3>Info Proses Giling</h3>
            <div className="info-grid">
              <div><span>Tanggal</span><b>{formatDate(clock)}</b></div>
              <div><span>Jam</span><b>{formatTime(clock)}</b></div>
              <div><span>Shift</span><b>{getShiftByDate(clock)}</b></div>
              <div><span>Stok Siap</span><b>{loadingGudang ? 'Loading...' : `${wasteGudang.length} ID`}</b></div>
            </div>
          </div>

          <form className="form-wrap" onSubmit={submitProsesGiling}>
            <label>Cari ID Waste Masuk</label>
            <div className="search-wrap">
              <div className="search-row">
                <input
                  value={searchGiling}
                  onChange={(e) => {
                    setSearchGiling(e.target.value);
                    setSelectedGiling(null);
                  }}
                  placeholder="Ketik ID / nama waste..."
                />
                {searchGiling && (
                  <button type="button" className="clear-btn" onClick={() => {
                    setSearchGiling('');
                    setSelectedGiling(null);
                  }}>
                    ×
                  </button>
                )}
              </div>

              {searchGiling && !selectedGiling && (
                <div className="suggestion-box">
                  {loadingGudang && <div className="suggestion-item muted">Loading...</div>}
                  {!loadingGudang && filteredGiling.length === 0 && (
                    <div className="suggestion-item muted">Tidak ada stok tersedia.</div>
                  )}
                  {filteredGiling.map((item) => (
                    <button
                      key={item.id_waste_masuk}
                      type="button"
                      className="suggestion-item"
                      onClick={() => {
                        setSelectedGiling(item);
                        setSearchGiling(`${item.id_waste_masuk} - ${item.nama_waste}`);
                      }}
                    >
                      <b>{item.id_waste_masuk}</b>
                      <span>{item.nama_waste}</span>
                      <small>
                        {item.plant_asal} • {item.area_asal} • Line {item.line} • Sisa{' '}
                        {formatNumber(item.sisa_waste_gudang)} KG
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedGiling && (
              <div className="detail-box">
                <div className="detail-title">Detail Waste Gudang</div>
                <div className="detail-grid">
                  <span>ID Waste</span><b>{selectedGiling.id_waste_masuk}</b>
                  <span>Nama Waste</span><b>{selectedGiling.nama_waste}</b>
                  <span>Sisa Gudang</span><b>{formatNumber(selectedGiling.sisa_waste_gudang)} KG</b>
                </div>
              </div>
            )}

            <label>Qty Masuk Proses Giling (KG)</label>
            <input
              value={qtyGiling}
              onChange={(e) => setQtyGiling(e.target.value)}
              inputMode="decimal"
              placeholder="Contoh: 50"
            />

            <label>Keterangan</label>
            <textarea
              value={keteranganGiling}
              onChange={(e) => setKeteranganGiling(e.target.value)}
              placeholder="Contoh: proses giling pagi"
            />

            <button className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Proses Giling'}
            </button>

            <div className="bottom-actions">
              <button type="button" className="ghost-btn wide" onClick={() => setPage('formMenu')}>
                Back
              </button>
              <button type="button" className="ghost-btn wide" onClick={() => openHistory('prosesGiling')}>
                Lihat History
              </button>
            </div>
          </form>

          {notif && (
            <div className={`notif ${notif.type}`}>
              <b>{notif.message}</b>
              {notif.detail && <span>{notif.detail}</span>}
            </div>
          )}
        </main>
      )}

      {page === 'hasilGiling' && (
        <main className="page-card">
          <div className="info-card">
            <h3>Info Hasil Giling</h3>
            <div className="info-grid">
              <div><span>Tanggal</span><b>{formatDate(clock)}</b></div>
              <div><span>Jam</span><b>{formatTime(clock)}</b></div>
              <div><span>Shift</span><b>{getShiftByDate(clock)}</b></div>
              <div><span>Proses Aktif</span><b>{loadingProses ? 'Loading...' : `${prosesGiling.length} ID`}</b></div>
            </div>
          </div>

          <form className="form-wrap" onSubmit={submitHasilGiling}>
            <label>Cari ID Proses Giling</label>
            <div className="search-wrap">
              <div className="search-row">
                <input
                  value={searchHasil}
                  onChange={(e) => {
                    setSearchHasil(e.target.value);
                    setSelectedHasil(null);
                  }}
                  placeholder="Ketik ID / nama waste / bubuk..."
                />
                {searchHasil && (
                  <button type="button" className="clear-btn" onClick={() => {
                    setSearchHasil('');
                    setSelectedHasil(null);
                  }}>
                    ×
                  </button>
                )}
              </div>

              {searchHasil && !selectedHasil && (
                <div className="suggestion-box">
                  {loadingProses && <div className="suggestion-item muted">Loading...</div>}
                  {!loadingProses && filteredHasil.length === 0 && (
                    <div className="suggestion-item muted">Tidak ada proses tersedia.</div>
                  )}
                  {filteredHasil.map((item) => (
                    <button
                      key={item.id_waste_masuk}
                      type="button"
                      className="suggestion-item"
                      onClick={() => {
                        setSelectedHasil(item);
                        setSearchHasil(`${item.id_waste_masuk} - ${item.nama_waste}`);
                      }}
                    >
                      <b>{item.id_waste_masuk}</b>
                      <span>{item.nama_waste}</span>
                      <small>
                        Bubuk: {item.nama_bubuk || '-'} • Sisa {formatNumber(item.sisa_proses_giling)} KG
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedHasil && (
              <div className="detail-box">
                <div className="detail-title">Detail Proses Giling</div>
                <div className="detail-grid">
                  <span>ID Waste</span><b>{selectedHasil.id_waste_masuk}</b>
                  <span>Nama Waste</span><b>{selectedHasil.nama_waste}</b>
                  <span>Nama Bubuk</span><b>{selectedHasil.nama_bubuk || '-'}</b>
                  <span>Sisa Proses</span><b>{formatNumber(selectedHasil.sisa_proses_giling)} KG</b>
                </div>
              </div>
            )}

            <label>Qty Selesai Digiling (KG)</label>
            <input
              value={qtyHasil}
              onChange={(e) => setQtyHasil(e.target.value)}
              inputMode="decimal"
              placeholder="Contoh: 60"
            />

            <label>Qty Bubuk Bersih Aktual (KG)</label>
            <input
              value={qtyBersihHasil}
              onChange={(e) => setQtyBersihHasil(e.target.value)}
              inputMode="decimal"
              placeholder="Contoh: 45"
            />

            <label>Qty PCS Bersih</label>
            <input
              value={qtyPcsBersih}
              onChange={(e) => {
                setQtyPcsBersih(e.target.value);
                setPcsManualEdited(true);
              }}
              inputMode="numeric"
              placeholder="Auto dari KG / 20, bisa diedit"
            />

            {qtyHasil && qtyBersihHasil && (
              <div className="detail-box">
                <div className="detail-title">Preview Hasil Giling</div>
                <div className="detail-grid">
                  <span>Qty Proses</span><b>{formatNumber(parseNumber(qtyHasil))} KG</b>
                  <span>Bubuk Bersih</span><b>{formatNumber(parseNumber(qtyBersihHasil))} KG</b>
                  <span>PCS Bersih</span><b>{qtyPcsBersih || 0}</b>
                  <span>Waste Kotor</span><b>{formatNumber(parseNumber(qtyHasil) - parseNumber(qtyBersihHasil))} KG</b>
                  <span>Yield Realisasi</span>
                  <b>
                    {parseNumber(qtyHasil) > 0
                      ? formatNumber((parseNumber(qtyBersihHasil) / parseNumber(qtyHasil)) * 100)
                      : 0}
                    %
                  </b>
                </div>
              </div>
            )}

            <label>Keterangan</label>
            <textarea
              value={keteranganHasil}
              onChange={(e) => setKeteranganHasil(e.target.value)}
              placeholder="Contoh: hasil crusher pagi"
            />

            <button className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Hasil Giling'}
            </button>

            <div className="bottom-actions">
              <button type="button" className="ghost-btn wide" onClick={() => setPage('formMenu')}>
                Back
              </button>
              <button type="button" className="ghost-btn wide" onClick={() => openHistory('hasilGiling')}>
                Lihat History
              </button>
            </div>
          </form>

          {notif && (
            <div className={`notif ${notif.type}`}>
              <b>{notif.message}</b>
              {notif.detail && <span>{notif.detail}</span>}
            </div>
          )}
        </main>
      )}

      {page === 'pengirimanBersih' && (
        <main className="page-card">
          <div className="info-card">
            <h3>Info Pengiriman ke Produksi</h3>
            <div className="info-grid">
              <div><span>Tanggal</span><b>{formatDate(clock)}</b></div>
              <div><span>Jam</span><b>{formatTime(clock)}</b></div>
              <div><span>Shift</span><b>{getShiftByDate(clock)}</b></div>
              <div><span>Batch Siap</span><b>{loadingBubuk ? 'Loading...' : `${stokBubuk.length} Batch`}</b></div>
            </div>
          </div>

          <form className="form-wrap" onSubmit={submitPengirimanBersih}>
            <label>Cari Batch Bubuk</label>
            <div className="search-wrap">
              <div className="search-row">
                <input
                  value={searchKirim}
                  onChange={(e) => {
                    setSearchKirim(e.target.value);
                    setSelectedKirim(null);
                  }}
                  placeholder="Ketik no batch / nama bubuk..."
                />
                {searchKirim && (
                  <button type="button" className="clear-btn" onClick={() => {
                    setSearchKirim('');
                    setSelectedKirim(null);
                  }}>
                    ×
                  </button>
                )}
              </div>

              {searchKirim && !selectedKirim && (
                <div className="suggestion-box">
                  {loadingBubuk && <div className="suggestion-item muted">Loading...</div>}
                  {!loadingBubuk && filteredKirim.length === 0 && (
                    <div className="suggestion-item muted">Tidak ada stok bubuk tersedia.</div>
                  )}
                  {filteredKirim.map((item) => (
                    <button
                      key={item.no_batch_bubuk}
                      type="button"
                      className="suggestion-item"
                      onClick={() => {
                        setSelectedKirim(item);
                        setSearchKirim(`${item.no_batch_bubuk} - ${item.nama_bubuk}`);
                      }}
                    >
                      <b>{item.no_batch_bubuk}</b>
                      <span>{item.nama_bubuk}</span>
                      <small>
                        Sisa {formatNumber(item.sisa_bubuk_bersih)} KG • PCS{' '}
                        {formatNumber(item.sisa_pcs_bersih)}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedKirim && (
              <div className="detail-box">
                <div className="detail-title">Detail Stok Bubuk</div>
                <div className="detail-grid">
                  <span>No Batch</span><b>{selectedKirim.no_batch_bubuk}</b>
                  <span>Nama Bubuk</span><b>{selectedKirim.nama_bubuk}</b>
		  <span>Expired</span><b>{selectedKirim.expired_date || '-'}</b>
                  <span>Qty Awal</span><b>{formatNumber(selectedKirim.qty_bersih)} KG</b>
                  <span>Sisa KG</span><b>{formatNumber(selectedKirim.sisa_bubuk_bersih)} KG</b>
                  <span>Sisa PCS</span><b>{formatNumber(selectedKirim.sisa_pcs_bersih)}</b>
                </div>
              </div>
            )}

            <label>Qty Kirim (KG)</label>
            <input
              value={qtyKirim}
              onChange={(e) => setQtyKirim(e.target.value)}
              inputMode="decimal"
              placeholder="Contoh: 23"
            />

            <label>Qty PCS Kirim</label>
            <input
              value={qtyPcsKirim}
              onChange={(e) => {
                setQtyPcsKirim(e.target.value);
                setPcsKirimManualEdited(true);
              }}
              inputMode="numeric"
              placeholder="Auto, bisa diedit"
            />

            <label>Tujuan Produksi</label>
            <select
              value={tujuanProduksi}
              onChange={(e) => {
                setTujuanProduksi(e.target.value);
                if (e.target.value !== 'LAINNYA') {
                  setTujuanLainnya('');
                  setNoKendaraan('');
                }
              }}
            >
              <option value="">Pilih tujuan</option>
              {TUJUAN_PRODUKSI_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === 'LAINNYA' ? 'Lainnya' : `Produksi ${item}`}
                </option>
              ))}
            </select>

            {tujuanProduksi === 'LAINNYA' && (
              <>
                <label>Tujuan Lainnya</label>
                <input
                  value={tujuanLainnya}
                  onChange={(e) => setTujuanLainnya(e.target.value)}
                  placeholder="Contoh: Vendor / Trial"
                />

                <label>No Kendaraan / Identitas Pengambil</label>
                <input
                  value={noKendaraan}
                  onChange={(e) => setNoKendaraan(e.target.value)}
                  placeholder="Contoh: B 1234 ABC / Pak Budi"
                />
              </>
            )}

            {qtyKirim && (
              <div className="detail-box">
                <div className="detail-title">Preview Pengiriman</div>
                <div className="detail-grid">
                  <span>Qty Kirim</span><b>{formatNumber(parseNumber(qtyKirim))} KG</b>
                  <span>PCS Kirim</span><b>{qtyPcsKirim || 0}</b>
                  <span>Tujuan</span>
                  <b>
                    {tujuanProduksi === 'LAINNYA'
                      ? tujuanLainnya || '-'
                      : tujuanProduksi
                      ? `Produksi ${tujuanProduksi}`
                      : '-'}
                  </b>
                </div>
              </div>
            )}

            <label>Keterangan</label>
            <textarea
              value={keteranganKirim}
              onChange={(e) => setKeteranganKirim(e.target.value)}
              placeholder="Contoh: kirim shift pagi"
            />

            <button className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Pengiriman'}
            </button>

            <div className="bottom-actions">
              <button type="button" className="ghost-btn wide" onClick={() => setPage('formMenu')}>
                Back
              </button>
              <button type="button" className="ghost-btn wide" onClick={() => openHistory('pengirimanBersih')}>
                Lihat History
              </button>
            </div>
          </form>

          {notif && (
            <div className={`notif ${notif.type}`}>
              <b>{notif.message}</b>
              {notif.detail && <span>{notif.detail}</span>}
            </div>
          )}
        </main>
      )}

      {page === 'pengeluaranKotor' && (
        <main className="page-card">
          <div className="info-card danger-card">
            <div className="info-header-row">
              <h3>Info Stok Waste Kotor</h3>
              <button type="button" className="ghost-btn mini" onClick={toggleRincianKotor}>
                {showRincianKotor ? 'Tutup Rincian' : 'Lihat Rincian'}
              </button>
            </div>

            <div className="info-grid">
              <div><span>Tanggal</span><b>{formatDate(clock)}</b></div>
              <div><span>Jam</span><b>{formatTime(clock)}</b></div>
              <div><span>Shift</span><b>{getShiftByDate(clock)}</b></div>
              <div><span>Total Masuk</span><b>{loadingKotor ? 'Loading...' : `${formatNumber(stokKotor.total_kotor_masuk)} KG`}</b></div>
              <div><span>Total Keluar</span><b>{loadingKotor ? 'Loading...' : `${formatNumber(stokKotor.total_kotor_keluar)} KG`}</b></div>
              <div><span>Sisa Kotor</span><b>{loadingKotor ? 'Loading...' : `${formatNumber(stokKotor.sisa_waste_kotor)} KG`}</b></div>
            </div>

            {showRincianKotor && (
              <div className="rincian-box">
                {loadingRincianKotor && <div className="empty-state">Loading rincian...</div>}
                {!loadingRincianKotor && rincianKotor.length === 0 && (
                  <div className="empty-state">Belum ada rincian waste kotor.</div>
                )}

                {!loadingRincianKotor &&
                  ['ASLI KOTOR', 'HASIL CRUSHER / HASIL GILING'].map((kategori) => {
                    const rows = rincianKotor.filter((item) => item.kategori === kategori);
                    if (rows.length === 0) return null;

                    return (
                      <div key={kategori} className="rincian-group">
                        <h4>{kategori}</h4>
                        {rows.map((item) => (
                          <div
                            key={`${kategori}-${item.kode_item}-${item.nama_item}`}
                            className="rincian-row"
                          >
                            <div>
                              <b>{item.nama_item}</b>
                              <small>
                                {item.kode_item} • {formatNumber(item.jumlah_transaksi)} transaksi
                              </small>
                            </div>
                            <strong>{formatNumber(item.total_kg)} KG</strong>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <form className="form-wrap" onSubmit={submitPengeluaranKotor}>
            <label>Qty Keluar Waste Kotor (KG)</label>
            <input
              value={qtyKotorKeluar}
              onChange={(e) => setQtyKotorKeluar(e.target.value)}
              inputMode="decimal"
              placeholder="Contoh: 100"
            />

            <label>Pembeli / Tujuan</label>
            <select
              value={pembeliKotor}
              onChange={(e) => {
                setPembeliKotor(e.target.value);
                if (e.target.value !== 'LAINNYA') {
                  setPembeliKotorLainnya('');
                  setIdentitasPengambilKotor('');
                }
              }}
            >
              <option value="">Pilih pembeli / tujuan</option>
              {supplierKotorOptions.map((item) => (
  <option key={item} value={item}>
    {item === 'LAINNYA' ? 'LAINNYA - TULIS MANUAL' : item}
  </option>
))}
            </select>

            {pembeliKotor === 'LAINNYA' && (
              <>
                <label>Pembeli / Tujuan Lainnya</label>
                <input
                  value={pembeliKotorLainnya}
                  onChange={(e) => setPembeliKotorLainnya(e.target.value)}
                  placeholder="Contoh: Vendor luar / pembuangan"
                />

                <label>Identitas Pengambil</label>
                <input
                  value={identitasPengambilKotor}
                  onChange={(e) => setIdentitasPengambilKotor(e.target.value)}
                  placeholder="Contoh: B 1234 ABC / Pak Budi / Vendor A"
                />
              </>
            )}

            {qtyKotorKeluar && (
              <div className="detail-box">
                <div className="detail-title">Preview Pengeluaran</div>
                <div className="detail-grid">
                  <span>Stok Sekarang</span><b>{formatNumber(stokKotor.sisa_waste_kotor)} KG</b>
                  <span>Qty Keluar</span><b>{formatNumber(parseNumber(qtyKotorKeluar))} KG</b>
                  <span>Sisa Setelah Keluar</span>
                  <b>{formatNumber(Number(stokKotor.sisa_waste_kotor || 0) - parseNumber(qtyKotorKeluar))} KG</b>
                  <span>Pembeli / Tujuan</span>
                  <b>
                    {pembeliKotor === 'LAINNYA'
                      ? pembeliKotorLainnya || '-'
                      : pembeliKotor || '-'}
                  </b>
                </div>
              </div>
            )}

            <label>Keterangan</label>
            <textarea
              value={keteranganKotor}
              onChange={(e) => setKeteranganKotor(e.target.value)}
              placeholder="Contoh: dijual / dibuang / adjustment"
            />

            <button className="submit-btn" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Pengeluaran Kotor'}
            </button>

            <div className="bottom-actions">
              <button type="button" className="ghost-btn wide" onClick={() => setPage('formMenu')}>
                Back
              </button>
              <button type="button" className="ghost-btn wide" onClick={() => openHistory('pengeluaranKotor')}>
                Lihat History
              </button>
            </div>
          </form>

          {notif && (
            <div className={`notif ${notif.type}`}>
              <b>{notif.message}</b>
              {notif.detail && <span>{notif.detail}</span>}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
