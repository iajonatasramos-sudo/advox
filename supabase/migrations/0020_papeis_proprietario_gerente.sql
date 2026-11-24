-- Hierarquia comercial: Proprietário > Gerente > Coordenador > Consultor.
-- 'coord' segue sendo o Coordenador e 'rep' o Consultor (só muda o rótulo na tela).
-- Fica numa migration separada porque o valor novo de enum só pode ser usado
-- depois do commit (a 0021 já usa 'proprietario' e 'gerente').
alter type papel add value if not exists 'proprietario';
alter type papel add value if not exists 'gerente';
