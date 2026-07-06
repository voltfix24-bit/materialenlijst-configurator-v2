import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStamdata(caseType: string | undefined) {
  const artikelen = useQuery({
    queryKey: ["artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("artikelen").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rmuConfigs = useQuery({
    queryKey: ["rmu_configuraties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rmu_configuraties")
        .select("*, rmu_artikel:artikelen!rmu_configuraties_rmu_artikel_id_fkey(*), frame_artikel:artikelen!rmu_configuraties_frame_artikel_id_fkey(*), bodemplaat_artikel:artikelen!rmu_configuraties_bodemplaat_artikel_id_fkey(*)")
        .eq("actief", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rmuVeldArtikelen = useQuery({
    queryKey: ["rmu_veld_artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rmu_veld_artikelen").select("*, artikel:artikel_id(*)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rmuZekeringen = useQuery({
    queryKey: ["rmu_zekeringen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rmu_zekeringen").select("*, artikel:artikel_id(*)");
      if (error) throw error;
      return data ?? [];
    },
  });



  const msMofTypes = useQuery({
    queryKey: ["ms_mof_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ms_mof_types").select("*, artikel:artikel_id(*)").eq("actief", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const msMofMaterialen = useQuery({
    queryKey: ["ms_mof_materialen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ms_mof_materialen").select("*, artikel:artikel_id(*)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lsMofTypes = useQuery({
    queryKey: ["ls_mof_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ls_mof_types").select("*").eq("actief", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lsMofMaterialen = useQuery({
    queryKey: ["ls_mof_materialen"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ls_mof_materialen").select("*, artikel:artikel_id(*)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const standaardTemplates = useQuery({
    queryKey: ["standaard_materialen_templates", caseType],
    enabled: !!caseType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("standaard_materialen_templates")
        .select("*, artikel:artikel_id(*)")
        .eq("case_type", caseType!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stationVaste = useQuery({
    queryKey: ["station_vaste_artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_vaste_artikelen")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const ggiRegels = useQuery({
    queryKey: ["ggi_artikelen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ggi_artikelen")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const trafoRegels = useQuery({
    queryKey: ["trafo_regels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trafo_regels")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lsRekRegels = useQuery({
    queryKey: ["ls_rek_regels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ls_rek_regels")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const provRegels = useQuery({
    queryKey: ["prov_regels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prov_regels")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const msKabelRegels = useQuery({
    queryKey: ["ms_kabel_regels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ms_kabel_regels")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rmuVeldRegels = useQuery({
    queryKey: ["rmu_veld_regels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rmu_veld_regels")
        .select("*, artikel:artikel_id(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const trafoVultKabelSpecs = useQuery({
    queryKey: ["trafo_vult_kabel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trafo_vult_kabel")
        .select("*, kabel_artikel:artikelen!trafo_vult_kabel_kabel_artikel_fk(*), perskabelschoen_artikel:artikelen!trafo_vult_kabel_pers_artikel_fk(*), muurbeugel_artikel:artikelen!trafo_vult_kabel_muurbeugel_artikel_fk(*)")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Eigen (via Beheer aangemaakte) vragen incl. hun regels + artikelen.
  const maatwerkVragen = useQuery({
    queryKey: ["maatwerk_vragen"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_vragen")
        .select("*, regels:maatwerk_vraag_regels(*, artikel:artikel_id(*))")
        .eq("actief", true)
        .order("sort_order");
      // Tabel bestaat pas na de eigen-vragen-migratie — tot die tijd gewoon
      // geen eigen vragen (feature verschijnt vanzelf na de migratie).
      if (error) return [];
      return data ?? [];
    },
  });

  // Eigen hoofdstukken waarin eigen vragen geplaatst kunnen worden.
  const maatwerkHoofdstukken = useQuery({
    queryKey: ["maatwerk_hoofdstukken"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maatwerk_hoofdstukken")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) return [];
      return data ?? [];
    },
  });

  const lsBeveiligingOpties = useQuery({
    queryKey: ["ls_beveiliging_opties"],
    queryFn: async () => {
      // Handmatige join — er is geen FK ls_beveiliging_opties.artikel_id → artikelen.id,
      // dus PostgREST kan geen embed resolven; we joinen in code.
      const { data: opties, error } = await supabase
        .from("ls_beveiliging_opties")
        .select("*")
        .eq("actief", true)
        .order("sort_order");
      if (error) throw error;
      const ids = [...new Set((opties ?? []).map((o) => o.artikel_id).filter(Boolean) as string[])];
      let byId = new Map<string, { id: string; artikel_nummer: string; korte_omschrijving: string; actief: boolean }>();
      if (ids.length > 0) {
        const { data: arts } = await supabase
          .from("artikelen")
          .select("id, artikel_nummer, korte_omschrijving, actief")
          .in("id", ids);
        byId = new Map((arts ?? []).map((a) => [a.id as string, a as never]));
      }
      return (opties ?? []).map((o) => ({
        ...o,
        artikel: o.artikel_id ? byId.get(o.artikel_id as string) ?? null : null,
      }));
    },
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
