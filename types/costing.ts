export interface MaterialPattern {
  key: string;
  patterns: RegExp[];
}

export interface MaterialMatch {
  key: string;
  pattern: RegExp;
  normalized: string;
}

export interface ColumnMap {
  qtyCol: number;
  materialCols: Map<string, number>;
}
