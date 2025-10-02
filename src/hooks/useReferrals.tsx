import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Generate code using the database function
      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_referral_code");
      
      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from("referral_codes")
        .insert({
          code: codeData,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-code"] });
      toast.success("Referral code generated!");
    },
    onError: (error) => {
      toast.error(`Failed to generate referral code: ${error.message}`);
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Referral code copied to clipboard!");
  };

  return {
    referralCode,
    referrals,
    codeLoading,
    referralsLoading,
    isLoading: codeLoading || referralsLoading,
    generateCode: generateCodeMutation.mutate,
    isGenerating: generateCodeMutation.isPending,
    copyCode,
  };
};
