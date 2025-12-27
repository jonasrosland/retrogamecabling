import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertDiagram, type UpdateDiagramRequest } from "@shared/routes";

export function useDiagrams() {
  return useQuery({
    queryKey: [api.diagrams.list.path],
    queryFn: async () => {
      const res = await fetch(api.diagrams.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch diagrams");
      return api.diagrams.list.responses[200].parse(await res.json());
    },
  });
}

export function useDiagram(id: number | null) {
  return useQuery({
    queryKey: [api.diagrams.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.diagrams.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch diagram");
      
      return api.diagrams.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDiagram) => {
      const validated = api.diagrams.create.input.parse(data);
      const res = await fetch(api.diagrams.create.path, {
        method: api.diagrams.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create diagram");
      return api.diagrams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.diagrams.list.path] });
    },
  });
}

export function useUpdateDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateDiagramRequest) => {
      const validated = api.diagrams.update.input.parse(updates);
      const url = buildUrl(api.diagrams.update.path, { id });
      
      const res = await fetch(url, {
        method: api.diagrams.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update diagram");
      return api.diagrams.update.responses[200].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.diagrams.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.diagrams.get.path, variables.id] });
    },
  });
}

export function useDeleteDiagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.diagrams.delete.path, { id });
      const res = await fetch(url, { method: api.diagrams.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete diagram");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.diagrams.list.path] });
    },
  });
}
