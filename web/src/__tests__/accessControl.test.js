import { describe, expect, it } from 'vitest';
import { canAccessRoute, isKnownRole, landingRoute } from '../utils/accessControl';

describe('perfis de acesso', () => {
  it('administrador cuida da gestão: cadastros, custos, estoque e templates', () => {
    for (const route of ['/cadastros', '/custos', '/estoque', '/templates', '/configuracoes']) {
      expect(canAccessRoute('Administrador', route)).toBe(true);
    }
    expect(canAccessRoute('Administrador', '/cirurgia')).toBe(false);
  });

  it('veterinário vê cirurgias e internação, mas não o estoque nem a antiga tela de insumos', () => {
    expect(canAccessRoute('Veterinário', '/cirurgia')).toBe(true);
    expect(canAccessRoute('Veterinário', '/internacao')).toBe(true);
    expect(canAccessRoute('Veterinário', '/estoque')).toBe(false);
    expect(canAccessRoute('Veterinário', '/insumos')).toBe(false);
  });

  it('esteticista vê só banho e tosa', () => {
    expect(canAccessRoute('Esteticista Animal', '/banho-tosa')).toBe(true);
    expect(canAccessRoute('Esteticista Animal', '/cirurgia')).toBe(false);
  });

  it('perfil desconhecido não acessa nada', () => {
    expect(isKnownRole('Visitante')).toBe(false);
    expect(canAccessRoute('Visitante', '/configuracoes')).toBe(false);
  });

  it('cada perfil começa na sua tela principal', () => {
    expect(landingRoute('Administrador')).toBe('/cadastros');
    expect(landingRoute('Veterinário')).toBe('/cirurgia');
    expect(landingRoute('Esteticista Animal')).toBe('/banho-tosa');
  });
});
