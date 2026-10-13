-- Beleg-Erfassung: neues Feld "Bezahlt durch" (Freitext, beim Erfassen mit
-- dem Namen des eingeloggten Benutzers vorausgefüllt, überschreibbar).
-- Rein additiv: bestehende Belege bleiben unverändert (Wert leer) und
-- können bei Bedarf manuell nachgetragen werden.
alter table receipts add column if not exists paid_by text;
