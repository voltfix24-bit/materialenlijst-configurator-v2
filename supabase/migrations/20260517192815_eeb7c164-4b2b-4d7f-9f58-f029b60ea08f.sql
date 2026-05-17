DELETE FROM public.rmu_veld_artikelen
WHERE veld_type IN ('C','V')
  AND merk IN ('ABB','Siemens','Magnefix');