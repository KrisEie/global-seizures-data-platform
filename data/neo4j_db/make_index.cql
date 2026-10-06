
CREATE INDEX FOR (d:Date) ON (d.date_id);
CREATE INDEX FOR (dr:Drug) ON (dr.drug_id);
CREATE INDEX FOR (g:Global_Location) ON (g.global_location_id);
CREATE INDEX FOR (src:Source) ON (src.source_id);
CREATE INDEX FOR (sp:Spez_Location) ON (sp.spez_location_id);
CREATE INDEX FOR (t:Transportation) ON (t.transport_id);

CREATE INDEX FOR (s:Seizures) ON (s.seizure_id);
CREATE INDEX FOR (s:Seizures) ON (s.date_id);
CREATE INDEX FOR (s:Seizures) ON (s.drug_id);
CREATE INDEX FOR (s:Seizures) ON (s.global_location_id);
CREATE INDEX FOR (s:Seizures) ON (s.source_id);
CREATE INDEX FOR (s:Seizures) ON (s.spez_location_id);
