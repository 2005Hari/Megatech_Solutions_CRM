"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";
import { deleteQuotation } from "../actions/quotations";
import { useRouter } from "next/navigation";

interface Props {
  quotationId: string;
  refNo: string;
  redirectTo?: string;
  className?: string;
  showText?: boolean;
}

export default function DeleteQuotationButton({ quotationId, refNo, redirectTo, className, showText }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete quotation ${refNo}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await deleteQuotation(quotationId);
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } catch (error) {
        console.error("Failed to delete quotation:", error);
        alert("Failed to delete quotation.");
        setIsDeleting(false); // only reset on fail, on success we navigate/refresh
      }
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className={className || "h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"}
      onClick={handleDelete}
      disabled={isDeleting}
    >
      <Trash2 className="h-4 w-4" />
      {showText && <span className="ml-2">Delete</span>}
    </Button>
  );
}

