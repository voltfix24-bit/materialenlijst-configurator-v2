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
    isLoading:
      artikelen.isLoading ||
      rmuConfigs.isLoading ||
      msMofTypes.isLoading ||
      lsMofTypes.isLoading,
  };
}

export type Stamdata = ReturnType<typeof useStamdata>;
