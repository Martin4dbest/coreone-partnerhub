const fs = require("fs");

const file = "app/admin/page.tsx";
let source = fs.readFileSync(file, "utf8");

const start = source.indexOf('              <Link\n              <Link\n                href="/admin/referral-codes"');

const endMarker = '                Manage administrators <span className="ml-2" aria-hidden="true">→</span>\n              </Link>';

if (start === -1) {
  console.error("Expected malformed section not found. File unchanged.");
  process.exit(1);
}

const end = source.indexOf(endMarker, start);

if (end === -1) {
  console.error("Manage administrators section not found. File unchanged.");
  process.exit(1);
}

const replacement = `              <Link
                href="/admin/referral-codes"
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-800 transition hover:bg-rose-100"
              >
                Staff Referral Codes <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <Link
                href="/admin/admins"
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
              >
                Manage administrators <span className="ml-2" aria-hidden="true">→</span>
              </Link>`;

source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
fs.writeFileSync(file, source);
console.log("Admin links repaired successfully.");
