import { useState } from "react";
import { Share2, Facebook, Twitter, MessageCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface SocialShareProps {
  title: string;
  message: string;
  url?: string;
  hashtags?: string[];
  trigger?: React.ReactNode;
}

export function SocialShare({ 
  title, 
  message, 
  url = window.location.href, 
  hashtags = ["PogosLoyalty", "Rewards"],
  trigger
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const shareText = `${message} ${hashtags.map(tag => `#${tag}`).join(' ')}`;
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(url);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${message} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400');
    setIsOpen(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: message,
          url,
        });
        setIsOpen(false);
      } catch (error) {
        console.log('Share cancelled');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Achievement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{message}</p>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-2 gap-3">
            {navigator.share && (
              <Button
                variant="outline"
                onClick={handleNativeShare}
                className="w-full"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => handleShare('facebook')}
              className="w-full"
            >
              <Facebook className="h-4 w-4 mr-2" />
              Facebook
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleShare('twitter')}
              className="w-full"
            >
              <Twitter className="h-4 w-4 mr-2" />
              Twitter
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleShare('whatsapp')}
              className="w-full"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="w-full"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}