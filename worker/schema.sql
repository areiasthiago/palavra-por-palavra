-- Só totais por dia. Nenhuma linha identifica uma pessoa ou um aparelho.
CREATE TABLE IF NOT EXISTS contagem (
  dia    TEXT    NOT NULL,             -- data em Brasília (AAAA-MM-DD)
  evento TEXT    NOT NULL,
  termo  TEXT    NOT NULL DEFAULT '',  -- palavra/assunto da lista, tipo de compartilhamento etc.
  canal  TEXT    NOT NULL DEFAULT '',  -- por onde o aparelho chegou na 1ª visita (wa, ig, tc...)
  origem TEXT    NOT NULL DEFAULT '',  -- de onde veio a busca (digitou, sugestao, quentes...)
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, evento, termo, canal, origem)
);

-- Teto por hora de cada evento/palavra, contra quem tentar inflar a lista de mais buscados.
CREATE TABLE IF NOT EXISTS limite (
  hora  TEXT    NOT NULL,              -- AAAA-MM-DDTHH (UTC)
  chave TEXT    NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hora, chave)
);
