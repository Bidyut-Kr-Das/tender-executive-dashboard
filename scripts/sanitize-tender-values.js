"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var prisma_1 = require("@/lib/prisma");
var rupees_1 = require("@/lib/rupees");
// Script: one-time cleanup of TenderMerged.value and TenderMerged.emd, using
// the same parsers as the Excel upload (lib/rupees.ts).
// Rule: a readable amount becomes plain rupees ("1.5 Cr" -> "15000000",
// "1,00,000 Rs" -> "100000", EMD "Advisory Bank: SBI | EMD Amount: 80000" ->
// "80000"); anything else ("NA", "Not visible", "EXEMPTION-BIS", PDF text)
// becomes "0", the same as an upload. Rows already in plain form are left alone.
// Usage: pnpm exec tsx scripts/sanitize-tender-values.ts          (dry run: prints the changes)
//        pnpm exec tsx scripts/sanitize-tender-values.ts --apply  (writes them)
var APPLY = process.argv.includes("--apply");
var BATCH_SIZE = 500;
var FIELDS = [
    { field: "value", parse: rupees_1.parseRupees },
    { field: "emd", parse: rupees_1.parseEmd },
];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var rows, changes, _loop_1, _i, FIELDS_1, field, i, batch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma_1.prisma.tenderMerged.findMany({
                        select: { id: true, referenceNo: true, value: true, emd: true },
                    })];
                case 1:
                    rows = _a.sent();
                    changes = FIELDS.flatMap(function (_a) {
                        var field = _a.field, parse = _a.parse;
                        return rows.flatMap(function (r) {
                            var current = r[field];
                            if (current == null)
                                return [];
                            var amount = parse(current);
                            var next = String(amount !== null && amount !== void 0 ? amount : 0);
                            return next === current ? [] : [{ id: r.id, referenceNo: r.referenceNo, field: field, current: current, next: next, unreadable: amount === null }];
                        });
                    });
                    _loop_1 = function (field) {
                        var mine = changes.filter(function (c) { return c.field === field; });
                        var zeroed = mine.filter(function (c) { return c.unreadable; }).length;
                        console.log("".concat(field, ": ").concat(mine.length - zeroed, " to convert, ").concat(zeroed, " unreadable to set to 0."));
                        for (var _b = 0, mine_1 = mine; _b < mine_1.length; _b++) {
                            var c = mine_1[_b];
                            console.log("  #".concat(c.id, " ").concat(c.referenceNo, ": ").concat(JSON.stringify(c.current).slice(0, 60), " -> ").concat(c.next));
                        }
                    };
                    for (_i = 0, FIELDS_1 = FIELDS; _i < FIELDS_1.length; _i++) {
                        field = FIELDS_1[_i].field;
                        _loop_1(field);
                    }
                    if (!APPLY) {
                        console.log("\nDry run. Re-run with --apply to write these changes.");
                        return [2 /*return*/];
                    }
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < changes.length)) return [3 /*break*/, 5];
                    batch = changes.slice(i, i + BATCH_SIZE);
                    return [4 /*yield*/, prisma_1.prisma.$transaction(batch.map(function (c) {
                            var _a;
                            return prisma_1.prisma.tenderMerged.update({ where: { id: c.id }, data: (_a = {}, _a[c.field] = c.next, _a) });
                        }))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i += BATCH_SIZE;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("\nUpdated ".concat(changes.length, " values."));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (err) {
    console.error(err);
    process.exitCode = 1;
})
    .finally(function () { return prisma_1.prisma.$disconnect(); });
