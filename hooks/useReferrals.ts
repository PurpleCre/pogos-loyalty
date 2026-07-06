import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { useOffline } from "./useOffline";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnline, saveOfflineData, getOfflineData } = useOffline();

  const { data: referralCode, isLoading: codeLoading } = useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      if (!isOnline) {
        const cached = await getOfflineData(`referralCode_${user.id}`);
        if (cached) return cached;
      }
      
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        const cached = await getOfflineData(`referralCode_${user.id}`);
        if (cached) return cached;
        throw error;
      }
      
      saveOfflineData(`referralCode_${user.id}`, data);
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      if (!isOnline) {
        const cached = await getOfflineData(`referrals_${user.id}`);
        if (cached) return cached;
      }
      
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        const cached = await getOfflineData(`referrals_${user.id}`);
        if (cached) return cached;
        throw error;
      }
      
      saveOfflineData(`referrals_${user.id}`, data);
      return data;
    },
    enabled: !!user,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      if (!isOnline) {
        Alert.alert("Offline", "Cannot generate referral code while offline");
        throw new Error("Offline");
      }

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
      Alert.alert("Success", "Referral code generated!");
    },
    onError: (error) => {
      if (error.message !== "Offline") {
        Alert.alert("Error", `Failed to generate referral code: ${error.message}`);
      }
    },
  });

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Success", "Referral code copied to clipboard!");
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
