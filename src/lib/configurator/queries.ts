import { useQuery } from "@tanstack/react-query";
import * as repo from "@/lib/data/stamdataRepo";

export function useStamdata(caseType: string | undefined) {
  const artikelen = useQuery({
    queryKey: ["artikelen"],
    queryFn: repo.fetchArtikelen,
  });

  const rmuConfigs = useQuery({
    queryKey: ["rmu_configuraties"],
    queryFn: repo.fetchRmuConfigs,
  });

  const rmuVeldArtikelen = useQuery({
    queryKey: ["rmu_veld_artikelen"],
    queryFn: repo.fetchRmuVeldArtikelen,
  });

  const rmuZekeringen = useQuery({
    queryKey: ["rmu_zekeringen"],
    queryFn: repo.fetchRmuZekeringen,
  });

  const msMofTypes = useQuery({
    queryKey: ["ms_mof_types"],
    queryFn: repo.fetchMsMofTypes,
  });

  const msMofMaterialen = useQuery({
    queryKey: ["ms_mof_materialen"],
    queryFn: repo.fetchMsMofMaterialen,
  });

  const lsMofTypes = useQuery({
    queryKey: ["ls_mof_types"],
    queryFn: repo.fetchLsMofTypes,
  });

  const lsMofMaterialen = useQuery({
    queryKey: ["ls_mof_materialen"],
    queryFn: repo.fetchLsMofMaterialen,
  });

  const standaardTemplates = useQuery({
    queryKey: ["standaard_materialen_templates", caseType],
    enabled: !!caseType,
    queryFn: () => repo.fetchStandaardTemplates(caseType!),
  });

  const stationVaste = useQuery({
    queryKey: ["station_vaste_artikelen"],
    queryFn: repo.fetchStationVaste,
  });

  const ggiRegels = useQuery({
    queryKey: ["ggi_artikelen"],
    queryFn: repo.fetchGgiRegels,
  });

  const trafoRegels = useQuery({
    queryKey: ["trafo_regels"],
    queryFn: repo.fetchTrafoRegels,
  });

  const lsRekRegels = useQuery({
    queryKey: ["ls_rek_regels"],
    queryFn: repo.fetchLsRekRegels,
  });

  const provRegels = useQuery({
    queryKey: ["prov_regels"],
    queryFn: repo.fetchProvRegels,
  });

  const msKabelRegels = useQuery({
    queryKey: ["ms_kabel_regels"],
    queryFn: repo.fetchMsKabelRegels,
  });

  const rmuVeldRegels = useQuery({
    queryKey: ["rmu_veld_regels"],
    queryFn: repo.fetchRmuVeldRegels,
  });

  const trafoVultKabelSpecs = useQuery({
    queryKey: ["trafo_vult_kabel"],
    queryFn: repo.fetchTrafoVultKabelSpecs,
  });

  const maatwerkVragen = useQuery({
    queryKey: ["maatwerk_vragen"],
    retry: false,
    queryFn: repo.fetchMaatwerkVragen,
  });

  const maatwerkHoofdstukken = useQuery({
    queryKey: ["maatwerk_hoofdstukken"],
    retry: false,
    queryFn: repo.fetchMaatwerkHoofdstukken,
  });

  const lsBeveiligingOpties = useQuery({
    queryKey: ["ls_beveiliging_opties"],
    queryFn: repo.fetchLsBeveiligingOpties,
  });

  return {
    artikelen,
    rmuConfigs,
    rmuVeldArtikelen,
    rmuZekeringen,
    msMofTypes,
    msMofMaterialen,
    lsMofTypes,
    lsMofMaterialen,
    standaardTemplates,
    stationVaste,
    ggiRegels,
    trafoRegels,
    lsRekRegels,
    provRegels,
    msKabelRegels,
    rmuVeldRegels,
    trafoVultKabelSpecs,
    lsBeveiligingOpties,
    maatwerkVragen,
    maatwerkHoofdstukken,
    isLoading:
      artikelen.isLoading ||
      rmuConfigs.isLoading ||
      rmuVeldArtikelen.isLoading ||
      rmuZekeringen.isLoading ||
      msMofTypes.isLoading ||
      msMofMaterialen.isLoading ||
      lsMofTypes.isLoading ||
      lsMofMaterialen.isLoading ||
      stationVaste.isLoading ||
      ggiRegels.isLoading ||
      trafoRegels.isLoading ||
      lsRekRegels.isLoading ||
      provRegels.isLoading ||
      msKabelRegels.isLoading ||
      rmuVeldRegels.isLoading ||
      trafoVultKabelSpecs.isLoading ||
      lsBeveiligingOpties.isLoading ||
      maatwerkVragen.isLoading,
  };
}

export type Stamdata = ReturnType<typeof useStamdata>;
