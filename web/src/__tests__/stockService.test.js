import { beforeEach, describe, expect, it, vi } from 'vitest';

// O teste não acessa o banco: o cliente do Supabase é substituído por um falso
const rpc = vi.fn();
vi.mock('../supabase', () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

const {
  consumeProcedure,
  daysUntil,
  formatDateBR,
  isStockTracked,
  maskDateBR,
  parseDateBR,
  procedureStockItems,
  summarizeLots,
  todayISO,
} = await import('../services/stockService');

const shift = (days) => {
  const [y, m, d] = todayISO().split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
};

describe('controle de estoque por item', () => {
  it('energia, tempo e diária não têm estoque; o resto tem, a menos que o cadastro diga outra coisa', () => {
    expect(isStockTracked({ unit: 'kwh' })).toBe(false);
    expect(isStockTracked({ unit: 'diaria' })).toBe(false);
    expect(isStockTracked({ unit: 'un' })).toBe(true);
    expect(isStockTracked({ unit: 'l', trackStock: false })).toBe(false);
    expect(isStockTracked(undefined)).toBe(false);
  });
});

describe('datas de validade', () => {
  it('converte DD/MM/AAAA e recusa datas que não existem', () => {
    expect(parseDateBR('31/12/2026')).toBe('2026-12-31');
    expect(parseDateBR('1/2/2027')).toBe('2027-02-01');
    expect(parseDateBR('  ')).toBeNull();
    expect(() => parseDateBR('31/02/2026')).toThrow('data de validade válida');
    expect(() => parseDateBR('2026-12-31')).toThrow('DD/MM/AAAA');
  });

  it('coloca as barras enquanto a pessoa digita', () => {
    expect(maskDateBR('31')).toBe('31');
    expect(maskDateBR('3112')).toBe('31/12');
    expect(maskDateBR('31122026')).toBe('31/12/2026');
    expect(maskDateBR('31/12/2026999')).toBe('31/12/2026');
  });

  it('conta os dias até a validade e formata para exibição', () => {
    expect(daysUntil(todayISO())).toBe(0);
    expect(daysUntil(shift(10))).toBe(10);
    expect(daysUntil(shift(-3))).toBe(-3);
    expect(daysUntil(null)).toBeNull();
    expect(formatDateBR('2026-12-31')).toBe('31/12/2026');
  });
});

describe('itens que um procedimento gasta', () => {
  const insumosMap = new Map([
    ['luva', { id: 'luva', unit: 'par' }],
    ['energia', { id: 'energia', unit: 'kwh' }],
  ]);

  it('multiplica pelas realizações, junta itens repetidos e ignora o que não tem estoque', () => {
    const procedure = {
      items: [
        { insumoId: 'luva', quantity: 2 },
        { insumoId: 'luva', quantity: 1 },
        { insumoId: 'energia', quantity: 3 },
        { insumoId: 'luva', quantity: 0 },
        { insumoId: 'apagado', quantity: 5 },
      ],
    };
    expect(procedureStockItems(procedure, insumosMap, 2)).toEqual([{ insumoId: 'luva', quantity: 6 }]);
  });
});

describe('saldo do estoque', () => {
  it('não conta lotes vencidos no saldo e calcula o custo médio e a próxima validade', () => {
    const lots = [
      { insumoId: 'soro', quantity: 10, unitCost: 8, expiresAt: shift(-1) }, // vencido
      { insumoId: 'soro', quantity: 20, unitCost: 8, expiresAt: shift(30) },
      { insumoId: 'soro', quantity: 20, unitCost: 10, expiresAt: shift(5) },
      { insumoId: 'gaze', quantity: 50, unitCost: 2.5, expiresAt: null },
    ];
    const stock = summarizeLots(lots);
    const soro = stock.get('soro');

    expect(soro.available).toBe(40);
    expect(soro.expired).toBe(10);
    expect(soro.averageCost).toBeCloseTo(9); // (20 × 8 + 20 × 10) / 40
    expect(soro.nextExpiry).toBe(shift(5));
    expect(stock.get('gaze').value).toBeCloseTo(125);
  });
});

describe('baixa do estoque ao registrar a realização', () => {
  beforeEach(() => rpc.mockReset());

  it('envia os itens para a função do banco', async () => {
    rpc.mockResolvedValue({ data: { atendimento_id: 'a1' }, error: null });
    await consumeProcedure({ procedure: { id: 'p1', name: 'Castração' }, items: [{ insumoId: 'luva', quantity: 4 }], notes: 'Thor' });

    expect(rpc).toHaveBeenCalledWith('registrar_consumo_estoque', {
      p_itens: [{ insumo_id: 'luva', quantidade: 4 }],
      p_procedure_id: 'p1',
      p_procedure_name: 'Castração',
      p_observacao: 'Thor',
    });
  });

  it('quando falta estoque, devolve a lista do que falta', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'ESTOQUE_INSUFICIENTE', details: '[{"insumo_id": "luva", "necessario": 9, "disponivel": 6}]' },
    });
    const attempt = consumeProcedure({ procedure: { id: 'p1', name: 'Castração' }, items: [{ insumoId: 'luva', quantity: 9 }] });

    await expect(attempt).rejects.toMatchObject({ missing: [{ insumoId: 'luva', needed: 9, available: 6 }] });
  });

  it('explica quando o banco ainda não tem as tabelas do estoque', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await expect(consumeProcedure({ procedure: { id: 'p1', name: 'X' }, items: [] })).rejects.toThrow('estoque ainda não foi criado');
  });
});
