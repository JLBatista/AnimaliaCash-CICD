import { describe, expect, it } from 'vitest';
import { calculateProcedure, getDefaultCommissionPercent, matchesWeightRange } from '../utils/costCalculations';

const settings = {
  hourlyOperationalRate: 60,
  includeLaborInCost: true,
  defaultVetCommissionSurgeryPercent: 25,
  defaultVetCommissionInternmentPercent: 20,
  defaultVetCommissionBathPercent: 15,
  externalProfessionals: [
    { id: 'prof_anesthetist_default', name: 'Anestesista', specialty: 'Anestesiologia', defaultCost: 250 },
    { id: 'prof_cardio', name: 'Cardiologista', specialty: 'Cardiologia', defaultCost: 150 },
  ],
};

const insumosMap = new Map([
  ['luva', { id: 'luva', name: 'Luva', unit: 'par', costPerUnit: 4.5 }],
  ['seringa', { id: 'seringa', name: 'Seringa', unit: 'un', costPerUnit: 1 }],
]);

describe('calculateProcedure', () => {
  it('soma insumos, custo operacional pelo tempo e comissão padrão da categoria', () => {
    const banho = {
      category: 'banho_tosa',
      durationMinutes: 30,
      items: [{ insumoId: 'luva', quantity: 2 }, { insumoId: 'seringa', quantity: 11 }],
    };
    const { breakdown } = calculateProcedure(banho, insumosMap, settings);

    expect(breakdown.directCost).toBeCloseTo(20); // 2 × 4,50 + 11 × 1,00
    expect(breakdown.operationalCost).toBeCloseTo(30); // meia hora a R$ 60/h
    expect(breakdown.vetCommissionCost).toBeCloseTo(7.5); // 15% de (insumos + operacional)
    expect(breakdown.externalProfessionalCost).toBe(0);
    expect(breakdown.totalCost).toBeCloseTo(57.5);
  });

  it('lança o anestesista terceirizado automaticamente nas cirurgias', () => {
    const cirurgia = { category: 'cirurgia', durationMinutes: 60, items: [] };
    const result = calculateProcedure(cirurgia, insumosMap, settings);

    expect(result.breakdown.externalProfessionalCost).toBe(250);
    expect(result.externalProfessionalDetails[0].name).toBe('Anestesista');
  });

  it('calcula a comissão sobre o preço menos o custo dos terceirizados', () => {
    const cirurgia = {
      category: 'cirurgia',
      durationMinutes: 60,
      suggestedPrice: 1000,
      items: [],
      externalProfessionalAssignments: [
        { professionalId: 'prof_anesthetist_default', cost: 250 },
        { professionalId: 'prof_cardio', cost: 150 },
      ],
    };
    const { breakdown } = calculateProcedure(cirurgia, insumosMap, settings);

    expect(breakdown.externalProfessionalCost).toBe(400);
    expect(breakdown.vetCommissionCost).toBeCloseTo(150); // 25% de (1000 − 400)
  });

  it('usa a comissão fixa quando o procedimento tem valor próprio', () => {
    const internacao = { category: 'internacao', durationMinutes: 1440, laborMinutes: 60, vetCommissionType: 'fixed', vetCommissionValue: 80, items: [] };
    expect(calculateProcedure(internacao, insumosMap, settings).breakdown.vetCommissionCost).toBe(80);
  });

  it('na internação, o custo operacional usa o tempo de atendimento e não a diária inteira', () => {
    const internacao = { category: 'internacao', durationMinutes: 1440, laborMinutes: 90, items: [] };
    expect(calculateProcedure(internacao, insumosMap, settings).breakdown.operationalCost).toBeCloseTo(90);
  });

  it('sem mão de obra no custo, o operacional fica só com o custo fixo do procedimento', () => {
    const semMaoDeObra = { ...settings, includeLaborInCost: false };
    const procedimento = { category: 'banho_tosa', durationMinutes: 120, fixedOverheadCost: 12, items: [] };
    expect(calculateProcedure(procedimento, insumosMap, semMaoDeObra).breakdown.operationalCost).toBe(12);
  });

  it('marca itens que não existem mais no estoque', () => {
    const procedimento = { category: 'banho_tosa', durationMinutes: 0, items: [{ insumoId: 'apagado', quantity: 3 }] };
    const { itemDetails, breakdown } = calculateProcedure(procedimento, insumosMap, settings);
    expect(itemDetails[0].missing).toBe(true);
    expect(breakdown.directCost).toBe(0);
  });
});

describe('regras auxiliares', () => {
  it('comissão padrão por categoria', () => {
    expect(getDefaultCommissionPercent('cirurgia', {})).toBe(25);
    expect(getDefaultCommissionPercent('internacao', {})).toBe(20);
    expect(getDefaultCommissionPercent('banho_tosa', {})).toBe(15);
  });

  it('faixas de peso dos filtros', () => {
    expect(matchesWeightRange(8, 'pequeno')).toBe(true);
    expect(matchesWeightRange(18, 'medio')).toBe(true);
    expect(matchesWeightRange(30, 'grande')).toBe(true);
    expect(matchesWeightRange(undefined, 'pequeno')).toBe(false);
    expect(matchesWeightRange(undefined, 'todos')).toBe(true);
  });
});
