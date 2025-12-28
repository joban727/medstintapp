"use client"

import { Facebook, Instagram, Linkedin } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useId } from "react"
import { Button } from "../../ui/button"
import { Card, CardFooter, CardTitle } from "../../ui/card"

interface TeamProps {
    imageUrl: string
    firstName: string
    lastName: string
    positions: string[]
    socialNetworks: SocialNetworkProps[]
}

interface SocialNetworkProps {
    name: string
    url: string
}

const teamList: TeamProps[] = [
    {
        imageUrl: "https://i.pravatar.cc/250?img=58",
        firstName: "Leo",
        lastName: "Miranda",
        positions: ["React Developer", "Content Creator"],
        socialNetworks: [
            {
                name: "LinkedIn",
                url: "https://www.linkedin.com/in/leopoldo-miranda/",
            },
            {
                name: "Facebook",
                url: "https://www.facebook.com/",
            },
            {
                name: "Instagram",
                url: "https://www.instagram.com/",
            },
        ],
    },
    {
        imageUrl: "https://i.pravatar.cc/250?img=59",
        firstName: "Tayla",
        lastName: "Kirsten",
        positions: ["Marketing Manager", "Social Media Specialist"],
        socialNetworks: [
            {
                name: "LinkedIn",
                url: "https://www.linkedin.com/",
            },
        ],
    },
    {
        imageUrl: "https://i.pravatar.cc/250?img=60",
        firstName: "Luan",
        lastName: "Gagliardi",
        positions: ["Full Stack Developer", "DevOps Engineer"],
        socialNetworks: [
            {
                name: "LinkedIn",
                url: "https://www.linkedin.com/",
            },
            {
                name: "Instagram",
                url: "https://www.instagram.com/",
            },
        ],
    },
    {
        imageUrl: "https://i.pravatar.cc/250?img=61",
        firstName: "Adalin",
        lastName: "Sara",
        positions: ["UI/UX Designer", "Graphic Designer"],
        socialNetworks: [
            {
                name: "LinkedIn",
                url: "https://www.linkedin.com/",
            },
            {
                name: "Facebook",
                url: "https://www.facebook.com/",
            },
            {
                name: "Instagram",
                url: "https://www.instagram.com/",
            },
        ],
    },
]

export const TeamSection = () => {
    const sectionId = useId()
    const socialIcon = (socialName: string) => {
        switch (socialName) {
            case "LinkedIn":
                return <Linkedin size="20" />
            case "Facebook":
                return <Facebook size="20" />
            case "Instagram":
                return <Instagram size="20" />
        }
    }
    return (
        <section id={`team-${sectionId}`} className="container mx-auto px-4 py-24 sm:py-32">
            <div className="mb-8 text-center">
                <h2 className="mb-2 text-center text-lg text-primary tracking-wider">Team</h2>
                <h2 className="text-center font-bold text-3xl md:text-4xl">The Company Dream Team</h2>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {teamList.map(({ imageUrl, firstName, lastName, positions, socialNetworks }, _index) => (
                    <Card
                        key={`team-member-${firstName.toLowerCase()}-${lastName.toLowerCase()}`}
                        className="group flex h-full flex-col overflow-hidden bg-muted/60 py-0"
                    >
                        {/* Header - Image Section */}
                        <div className="relative overflow-hidden">
                            <Image
                                src={imageUrl}
                                alt={`${firstName} ${lastName}`}
                                width={300}
                                height={300}
                                className="aspect-square w-full object-cover saturate-0 transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:saturate-100"
                            />
                        </div>
                        {/* Content - Name and Positions Section */}
                        <div className="flex-1 px-6">
                            <CardTitle className="mb-2 text-xl">
                                {firstName} <span className="ml-2 font-semibold text-primary">{lastName}</span>
                            </CardTitle>
                            <div className="gap-1">
                                {positions.map((position, _index) => (
                                    <div
                                        key={`position-${position.replace(/\s+/g, "-").toLowerCase()}-${position.length}`}
                                        className="text-muted-foreground text-sm leading-relaxed"
                                    >
                                        {position}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Footer - Social Links Section */}
                        <CardFooter className="mb-6 flex gap-3">
                            {socialNetworks.map(({ name, url }, _index) => (
                                <Link
                                    key={`social-${name.toLowerCase()}-${url.split("/").pop() || name}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="transition-all duration-200 hover:scale-110 hover:opacity-80"
                                    aria-label={`Visit ${firstName}'s ${name} profile`}
                                >
                                    {socialIcon(name)}
                                </Link>
                            ))}
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </section>
    )
}